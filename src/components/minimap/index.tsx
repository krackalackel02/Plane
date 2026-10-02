import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Vector3 } from "three";
import { useScene } from "../../context/sceneContext";
import { useProjects } from "../../context/projectContext";
import { useAutopilot } from "../../context/autopilotContext";
import {
  calculatedBoardPositionsAndRotations,
  pathFrameAt,
} from "../timeline/calculatedBoardPositionsAndRotations";
import { getBoardMatWorldPosition } from "../../utils/3d";
import { getActivePlanet, getShellRadius } from "../../utils/planets";
import { slerpOnSphere } from "../../utils/planetSurface";
import {
  CONTINENTS,
  continentOutlinePoint,
  scatterDesertFeatures,
  scatterRidges,
  scatterTrees,
} from "../planet/planetTerrain";
import {
  computeAzimuthalProjection,
  headingBearing,
  type AzimuthalProjection,
} from "./planetMapProjection";
import "./minimap.css";

// CSS pixel size of the map's drawing surface when collapsed - actual
// canvas backing store is this times devicePixelRatio. The expanded size
// is driven by CSS (see minimap.css) and measured live, see useMapSize.
const COLLAPSED_SIZE = 200;

/**
 * Track the minimap's actual rendered box size in CSS pixels. Collapsed
 * vs. expanded sizing lives entirely in CSS (including the mobile media
 * query), so rather than duplicating those breakpoints in JS, a
 * ResizeObserver reports whatever size the box ends up at - the planet-to
 * map projection and the canvas backing store both key off this.
 */
const useMapSize = (ref: RefObject<HTMLDivElement>) => {
  const [size, setSize] = useState(COLLAPSED_SIZE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box && box.width > 0) setSize(Math.round(box.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};

// How finely the trail is sampled for the minimap's own path line, and how
// finely a continent's own wavy coastline (see planetTerrain's
// outlineRadiusAt) is sampled for its minimap silhouette - both dense
// enough to read as smooth curves rather than faceted polygons at minimap
// scale, without needing the 3D mesh's much higher fidelity.
const PATH_SAMPLES = 180;
// Enough to keep the autopilot arc smooth even across half the planet.
const ROUTE_SAMPLES = 96;
const OUTLINE_SAMPLES = 64;
// Reuses the exact same deterministic scatter the 3D scene itself uses
// (see planet/index.tsx) - same count, same seeded positions - so the
// minimap shows literally the same trees the camera could see, not a
// separate approximation of them.
const TREE_COUNT = 90;
const DESERT_FEATURE_COUNT = 70;
const RIDGE_CHAIN_COUNT = 14;

// One per landmass biome, matching landmass.tsx's own materials so a
// continent reads as the same biome on the map as it does out the window.
const GREEN = "#7cc542";
const TAN = "#e3c896";
const SNOW_ROCK = "#dde6ef";
const SNOW_PEAK = "#ffffff";

interface ContinentShape {
  points: Vector3[];
  color: string;
}

type FeatureGlyphKind = "tree" | "dune" | "peak";

interface FeatureGlyphs {
  points: Vector3[];
  color: string;
  size: number;
  kind: FeatureGlyphKind;
}

/**
 * Every landmass's actual rendered footprint (see landmass.tsx), as flat
 * world-space outlines rather than a separate hand-drawn approximation -
 * reprojected fresh every frame through whatever toMap the map is
 * currently using (see draw() below), so "the island you fly past" and
 * "the island on the radar" are always the same shape.
 */
const buildContinentShapes = (
  planetRadius: number,
  center: Vector3,
): ContinentShape[] => {
  const shapes: ContinentShape[] = [];
  for (const c of CONTINENTS) {
    const outer = Array.from({ length: OUTLINE_SAMPLES }, (_, i) =>
      continentOutlinePoint(
        c,
        planetRadius,
        center,
        (i / OUTLINE_SAMPLES) * Math.PI * 2,
        1,
      ),
    );
    const variant = c.variant ?? "forest";
    // Every biome needs its own entry here: with only a desert case, the
    // snow continent fell through to green and was indistinguishable from
    // the forest one on the map, which made the planet look like it had two
    // forest continents and no snow one at all.
    const baseColor =
      variant === "desert" ? TAN : variant === "snow" ? SNOW_ROCK : GREEN;
    shapes.push({ points: outer, color: baseColor });
    if (c.highland) {
      const inner = Array.from({ length: OUTLINE_SAMPLES }, (_, i) =>
        continentOutlinePoint(
          c,
          planetRadius,
          center,
          (i / OUTLINE_SAMPLES) * Math.PI * 2,
          c.highland!.scale,
        ),
      );
      shapes.push({
        points: inner,
        color: variant === "snow" ? SNOW_PEAK : TAN,
      });
    }
  }
  return shapes;
};

/**
 * Everything about the world the minimap needs that *doesn't* depend on
 * where the ship currently is - computed once (or when the project list
 * changes) and reprojected through a fresh, ship-centered
 * computeAzimuthalProjection every time the map actually draws.
 */
const useMinimapWorldData = () => {
  const { items } = useProjects();
  const planet = getActivePlanet();

  return useMemo(() => {
    const boardsData = calculatedBoardPositionsAndRotations(items, planet);
    const shellRadius = getShellRadius(planet);
    const pathPoints = Array.from(
      { length: PATH_SAMPLES + 1 },
      (_, i) =>
        // pathFrameAt is parameterised by fraction-of-the-loop, not
        // longitude - the trail is a free curve on the sphere.
        pathFrameAt(shellRadius, i / PATH_SAMPLES, planet.center).position,
    );
    const continentShapes = buildContinentShapes(planet.radius, planet.center);
    // Exactly the same deterministic scatters the 3D scene renders, so the
    // map shows the real props rather than a separate approximation.
    const features: FeatureGlyphs[] = [
      {
        points: scatterTrees(TREE_COUNT, planet.radius, planet.center).map(
          (t) => t.position,
        ),
        color: "#2f6e3a",
        size: 2.2,
        kind: "tree",
      },
      {
        points: scatterDesertFeatures(
          DESERT_FEATURE_COUNT,
          planet.radius,
          planet.center,
        ).map((f) => f.position),
        color: "#c79a5e",
        size: 2.4,
        kind: "dune",
      },
      {
        points: scatterRidges(
          RIDGE_CHAIN_COUNT,
          planet.radius,
          planet.center,
        ).map((r) => r.position),
        color: "#52627a",
        size: 3,
        kind: "peak",
      },
    ];

    return { boardsData, pathPoints, continentShapes, features, planet };
  }, [items, planet]);
};

const drawBook = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  projectNumber: number,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#e8c468";
  ctx.strokeStyle = "#4a3a17";
  ctx.lineWidth = 1;
  // Open-book silhouette: two pages meeting at a center spine.
  ctx.beginPath();
  ctx.moveTo(0, -3.5);
  ctx.lineTo(-6, -5.5);
  ctx.lineTo(-6, 4.5);
  ctx.lineTo(0, 6.5);
  ctx.lineTo(6, 4.5);
  ctx.lineTo(6, -5.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -3.5);
  ctx.lineTo(0, 6.5);
  ctx.strokeStyle = "rgba(74, 58, 23, 0.7)";
  ctx.stroke();

  // Small numbered badge in the corner, so each project's position in the
  // list is readable at a glance.
  ctx.beginPath();
  ctx.arc(5.5, -5.5, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#1c1c1c";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.75;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 6px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(projectNumber), 5.5, -5.2);

  ctx.restore();
};

/**
 * The autopilot's route, as a dashed red line ending in a ringed destination
 * marker. Autopilot flies a pure great-circle slerp from where it engaged to
 * its target (see motions/autopilot/autopilot.ts), so slerping the ship's
 * current direction to the target's reproduces the *remaining* arc exactly,
 * recomputed free each frame - no route state to plumb through.
 */
const drawAutopilotRoute = (
  ctx: CanvasRenderingContext2D,
  shipPosition: Vector3,
  target: Vector3,
  planetCenter: Vector3,
  toMap: AzimuthalProjection["toMap"],
  size: number,
) => {
  const from = shipPosition.clone().sub(planetCenter);
  const to = target.clone().sub(planetCenter);
  const radius = from.length();
  const arc = Array.from({ length: ROUTE_SAMPLES + 1 }, (_, i) =>
    slerpOnSphere(from, to, i / ROUTE_SAMPLES)
      .multiplyScalar(radius)
      .add(planetCenter),
  );

  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = "#ff3b3b";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  // Split at the projection's antipodal singularity like the trail does - a
  // route to the planet's far side crosses it and would otherwise streak
  // straight across the map.
  for (const segment of projectPolyline(arc, toMap, size)) {
    ctx.beginPath();
    segment.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // "X marks the spot" ring at the destination.
  const [tx, ty] = toMap(target);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(tx, ty, 6.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tx, ty, 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ff3b3b";
  ctx.fill();
  ctx.restore();
};

const drawShipArrow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bearing: number,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bearing);
  ctx.fillStyle = "#ff3b3b";
  ctx.strokeStyle = "#7a0000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6, 7);
  ctx.lineTo(0, 4);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

// A projected 2D polyline/polygon can leap clear across the map between
// two consecutive samples if the underlying 3D points straddle the exact
// antipodal point from the viewer (the one singularity of an azimuthal
// equidistant projection - see planetMapProjection.ts). Any single-step
// jump bigger than the map's own diameter can only be that, never a real
// move, so it's the signal to break and start a fresh segment/subpath
// rather than drawing a spurious streak across the circle.
const isProjectionJump = (
  a: [number, number],
  b: [number, number],
  size: number,
): boolean => Math.hypot(a[0] - b[0], a[1] - b[1]) > size * 0.75;

const projectPolyline = (
  points: Vector3[],
  toMap: AzimuthalProjection["toMap"],
  size: number,
): [number, number][][] => {
  const raw = points.map((p) => toMap(p));
  const segments: [number, number][][] = [];
  let current: [number, number][] = [];
  for (const point of raw) {
    const previous = current[current.length - 1];
    if (previous && isProjectionJump(previous, point, size)) {
      segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length > 1) segments.push(current);
  return segments;
};

/**
 * Fills one landmass outline, handling the case where it wraps the map's
 * antipodal rim.
 *
 * On an azimuthal equidistant map the antipode of the centre is not a point
 * but the whole outer rim, so an outline that crosses it leaves one edge of
 * the disc and re-enters at a completely different bearing. Joining those two
 * points directly - which is what filling the raw projected polygon does -
 * draws a chord straight across the map and floods the disc with that
 * landmass's colour. Now that continents span ~50 degrees of arc, that fires
 * often enough to paint the whole minimap green.
 *
 * The fix is the standard one for azimuthal projections: where the outline
 * leaves the rim, walk *along* the rim to where it comes back, so the filled
 * region follows the disc's edge instead of cutting across it.
 */
const fillProjectedOutline = (
  ctx: CanvasRenderingContext2D,
  points: Vector3[],
  toMap: AzimuthalProjection["toMap"],
  size: number,
  color: string,
) => {
  const segments = projectPolyline(points, toMap, size);
  if (segments.length === 0) return;
  const mapRadius = size / 2;
  const bearingOf = ([x, y]: [number, number]): number =>
    Math.atan2(x - mapRadius, mapRadius - y);

  ctx.fillStyle = color;
  for (const segment of segments) {
    if (segment.length < 3) continue;
    ctx.beginPath();
    segment.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Only a split piece needs rim closure; a whole outline closes itself.
    if (segments.length > 1) {
      const from = bearingOf(segment[segment.length - 1]);
      const to = bearingOf(segment[0]);
      let sweep = to - from;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      while (sweep < -Math.PI) sweep += Math.PI * 2;
      const steps = Math.max(2, Math.ceil(Math.abs(sweep) / 0.12));
      for (let i = 1; i <= steps; i++) {
        const bearing = from + (sweep * i) / steps;
        ctx.lineTo(
          mapRadius + mapRadius * Math.sin(bearing),
          mapRadius - mapRadius * Math.cos(bearing),
        );
      }
    }

    ctx.closePath();
    ctx.fill();
  }
};

const drawContinents = (
  ctx: CanvasRenderingContext2D,
  shapes: ContinentShape[],
  toMap: AzimuthalProjection["toMap"],
  size: number,
) => {
  for (const shape of shapes) {
    fillProjectedOutline(ctx, shape.points, toMap, size, shape.color);
  }
};

/**
 * The scene's own scattered props, drawn as small iconic glyphs - conifers on
 * the forest, dunes on the desert, snow-capped peaks on the snow.
 *
 * Deliberately not plain dots: a field of identical circles tells you
 * something is *there* but not what it is, so the map stopped resembling the
 * planet you can actually see. A triangle with a white tip reads as a
 * mountain at four pixels across; a circle doesn't.
 */
const drawFeatureGlyphs = (
  ctx: CanvasRenderingContext2D,
  features: FeatureGlyphs[],
  toMap: AzimuthalProjection["toMap"],
  scale: number,
) => {
  for (const group of features) {
    const size = group.size * scale;
    ctx.fillStyle = group.color;

    for (const point of group.points) {
      const [x, y] = toMap(point);

      if (group.kind === "peak") {
        // Mountain: a triangle with a white cap, matching the 3D ridges.
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.85, y + size * 0.7);
        ctx.lineTo(x - size * 0.85, y + size * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.34, y - size * 0.2);
        ctx.lineTo(x - size * 0.34, y - size * 0.2);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.fillStyle = group.color;
        continue;
      }

      if (group.kind === "tree") {
        // Conifer: a narrow triangle on a short trunk.
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.62, y + size * 0.55);
        ctx.lineTo(x - size * 0.62, y + size * 0.55);
        ctx.closePath();
        ctx.fill();
        continue;
      }

      // Dune: a low mound, flat along the sand.
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.5, 0, Math.PI, 0);
      ctx.fill();
    }
  }
};

interface DrawOptions {
  showTrees: boolean;
  /** Where autopilot is flying to, when engaged - drives the dashed route. */
  autopilotTarget?: Vector3;
}

/**
 * GTA5-style minimap docked in the bottom-left corner: an azimuthal
 * equidistant "radar" of the whole planet, centered on and pinned to the
 * ship (see planetMapProjection's computeAzimuthalProjection) - everything
 * else, terrain included, slides and rotates around it as it flies, with a
 * red arrow rotating in place to show heading. Distance from center is
 * true angular distance on the sphere, so the entire planet - including
 * the far side - is always represented somewhere on the circle, not just
 * the near hemisphere.
 *
 * Tapping the dock expands it to a large, centered overlay (GTAV-style): a
 * single frozen snapshot centered on wherever the ship was the moment you
 * opened it (rather than continuing to slide live under your cursor while
 * you're trying to click something), with tree detail added in since
 * there's room for it. Picking a project marker engages autopilot to that
 * board and collapses the map back to its dock; tapping the backdrop, the
 * close button, or Escape collapses it without flying anywhere.
 */
const Minimap = () => {
  const { shipRef } = useScene();
  const {
    requestAutopilot,
    target: autopilotTarget,
    isFlying,
  } = useAutopilot();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Bounding rect captured the instant before an expand/collapse toggle,
  // consumed by the FLIP effect below.
  const preToggleRectRef = useRef<DOMRect | null>(null);
  const size = useMapSize(containerRef);
  const { boardsData, pathPoints, continentShapes, features, planet } =
    useMinimapWorldData();

  // The expanded view's single frozen snapshot - null while collapsed
  // (live) or before the first expand.
  const [frozenBoardPoints, setFrozenBoardPoints] = useState<
    { id: string; x: number; y: number }[]
  >([]);
  // The frozen projection itself, kept around (not just its board points)
  // so a click anywhere on the expanded map can be resolved back to a
  // world position via its toWorld - see handleMapClick below.
  const frozenProjectionRef = useRef<AzimuthalProjection | null>(null);
  // Read through a ref rather than a draw() dependency: autopilot engaging or
  // arriving would otherwise cancel and restart the rAF loop below.
  const autopilotRouteRef = useRef<Vector3 | null>(null);

  const draw = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      toMap: AzimuthalProjection["toMap"],
      drawSize: number,
      shipPosition: Vector3,
      shipBearing: number,
      options: DrawOptions,
    ) => {
      ctx.clearRect(0, 0, drawSize, drawSize);
      ctx.fillStyle = "#1c6bc2";
      ctx.fillRect(0, 0, drawSize, drawSize);

      drawContinents(ctx, continentShapes, toMap, drawSize);

      // The actual trail - the one path every board sits along and the
      // ship's usual cruise line - drawn as the map's single highlighted
      // line, matching the wiggly ring in the 3D scene.
      ctx.strokeStyle = "rgba(125, 211, 252, 0.9)";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      for (const segment of projectPolyline(pathPoints, toMap, drawSize)) {
        ctx.beginPath();
        segment.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      drawFeatureGlyphs(ctx, features, toMap, options.showTrees ? 1 : 0.72);

      boardsData.forEach((board, i) => {
        const [x, y] = toMap(getBoardMatWorldPosition(board));
        drawBook(ctx, x, y, i + 1);
      });

      if (options.autopilotTarget) {
        drawAutopilotRoute(
          ctx,
          shipPosition,
          options.autopilotTarget,
          planet.center,
          toMap,
          drawSize,
        );
      }

      // The projection is centered on the ship by construction, so its
      // own marker always sits at the exact middle of the circle.
      drawShipArrow(ctx, drawSize / 2, drawSize / 2, shipBearing);
    },
    [continentShapes, pathPoints, features, boardsData, planet],
  );

  // Collapsed: a live rAF loop, re-centering the projection on the ship's
  // current position every frame - a real radar.
  useEffect(() => {
    if (expanded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let frameId: number;
    const tick = () => {
      const ship = shipRef.current;
      if (ship) {
        const toMap = computeAzimuthalProjection(
          ship.position,
          size,
          planet.center,
        ).toMap;
        const bearing = headingBearing(
          ship.quaternion,
          ship.position,
          planet.center,
        );
        draw(ctx, toMap, size, ship.position, bearing, {
          showTrees: false,
          autopilotTarget: autopilotRouteRef.current ?? undefined,
        });
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [expanded, size, shipRef, planet, draw]);

  // Expanded: one frozen snapshot, centered on wherever the ship was the
  // moment it opened - drawn once (not per-frame), with tree detail added
  // and matching frozen marker positions for the clickable overlay below.
  useEffect(() => {
    if (!expanded) return;
    const canvas = canvasRef.current;
    const ship = shipRef.current;
    if (!canvas || !ship) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const shipPosition = ship.position.clone();
    const projection = computeAzimuthalProjection(
      shipPosition,
      size,
      planet.center,
    );
    frozenProjectionRef.current = projection;
    const { toMap } = projection;
    const bearing = headingBearing(
      ship.quaternion,
      shipPosition,
      planet.center,
    );
    draw(ctx, toMap, size, shipPosition, bearing, { showTrees: true });

    setFrozenBoardPoints(
      boardsData.map((board) => {
        const [x, y] = toMap(getBoardMatWorldPosition(board));
        return { id: board.id, x, y };
      }),
    );
  }, [expanded, size, shipRef, planet, draw, boardsData]);

  // Both directions go through the same rect capture so the FLIP effect
  // below can animate the toggle as one continuous element resizing,
  // rather than an instant jump followed by a width/height tween.
  useEffect(() => {
    // Gate on isFlying, not target alone: isFlying is separate state written
    // only by Physics, so target can briefly hold a stale value between the
    // useFrame write and the React re-render. Together they're only valid
    // during an actual flight.
    autopilotRouteRef.current =
      isFlying && autopilotTarget ? autopilotTarget.position : null;
  }, [isFlying, autopilotTarget]);

  const toggleExpanded = useCallback((next: boolean) => {
    if (containerRef.current) {
      preToggleRectRef.current = containerRef.current.getBoundingClientRect();
    }
    setExpanded(next);
  }, []);

  const expand = useCallback(() => toggleExpanded(true), [toggleExpanded]);
  const collapse = useCallback(() => toggleExpanded(false), [toggleExpanded]);

  // FLIP: right after the dock <-> expanded class swap lands (new layout,
  // not yet painted), work out how much the box just jumped and undo it
  // with an inline transform, then release that transform on the next
  // frame so the CSS transition animates it back to identity. The result
  // reads as the same circle growing/shrinking in place rather than a
  // size change plus a teleport to the screen center.
  useLayoutEffect(() => {
    const el = containerRef.current;
    const before = preToggleRectRef.current;
    preToggleRectRef.current = null;
    if (!el || !before) return;

    const after = el.getBoundingClientRect();
    if (after.width === 0 || after.height === 0) return;

    const scale = before.width / after.width;
    const dx = before.left + before.width / 2 - (after.left + after.width / 2);
    const dy = before.top + before.height / 2 - (after.top + after.height / 2);

    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    // Force layout so the transform above is actually committed before
    // it's released - otherwise the browser can coalesce both style
    // writes into one frame and no animation plays.
    el.getBoundingClientRect();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "";
        el.style.transform = "";
      });
    });
  }, [expanded]);

  // Escape collapses the expanded map, same as tapping off it.
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") collapse();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded, collapse]);

  const flyToBoard = (board: (typeof boardsData)[number]) => {
    requestAutopilot(getBoardMatWorldPosition(board), board.id);
    collapse();
  };

  // Clicking anywhere else on the expanded map (not a project marker)
  // engages autopilot toward that specific point on the planet, resolved
  // back from map pixels to a world position via the frozen projection's
  // own exact inverse (see planetMapProjection.ts's toWorld) - no board id,
  // since it isn't heading to a specific project (see
  // activationZone.tsx's autopilot-target guard).
  const handleMapClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const projection = frozenProjectionRef.current;
    const canvas = canvasRef.current;
    if (!projection || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const shellRadius = getShellRadius(planet);
    requestAutopilot(projection.toWorld(x, y, shellRadius));
    collapse();
  };

  // Only the collapsed dock is itself a single "expand" control - once
  // expanded, focus/interaction belongs to the close button and the
  // per-project markers inside it, not the container.
  const containerProps = expanded
    ? { role: "dialog" as const, "aria-label": "Map" }
    : {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": "Expand map",
        onClick: expand,
        onKeyDown: (event: ReactKeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            expand();
          }
        },
      };

  return (
    <>
      {expanded && (
        <div
          className="minimap-backdrop"
          onClick={collapse}
          aria-hidden="true"
        />
      )}
      <div
        ref={containerRef}
        className={`minimap${expanded ? " minimap-expanded" : ""}`}
        {...containerProps}
      >
        <div
          className="minimap-canvas-clip"
          onClick={expanded ? handleMapClick : undefined}
        >
          <canvas ref={canvasRef} />
        </div>
        <div className="minimap-compass minimap-compass--n">N</div>
        <div className="minimap-compass minimap-compass--e">E</div>
        <div className="minimap-compass minimap-compass--s">S</div>
        <div className="minimap-compass minimap-compass--w">W</div>
        {expanded && (
          <>
            {frozenBoardPoints.map(({ id, x, y }) => {
              const board = boardsData.find((b) => b.id === id);
              if (!board) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className="minimap-board-marker"
                  style={{ left: x, top: y }}
                  aria-label={`Fly to ${board.title ?? "project"}`}
                  onClick={() => flyToBoard(board)}
                />
              );
            })}
          </>
        )}
      </div>
    </>
  );
};

export default Minimap;
