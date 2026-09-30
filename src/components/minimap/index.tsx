import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type KeyboardEvent as ReactKeyboardEvent,
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
import {
  CONTINENTS,
  continentOutlinePoint,
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
const OUTLINE_SAMPLES = 20;
// Reuses the exact same deterministic scatter the 3D scene itself uses
// (see planet/index.tsx) - same count, same seeded positions - so the
// minimap shows literally the same trees the camera could see, not a
// separate approximation of them.
const TREE_COUNT = 90;

const GREEN = "#7cc542";
const TAN = "#e3c896";

interface ContinentShape {
  points: Vector3[];
  color: string;
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
    shapes.push({ points: outer, color: c.variant === "desert" ? TAN : GREEN });
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
      shapes.push({ points: inner, color: TAN });
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
        pathFrameAt(
          shellRadius,
          (i / PATH_SAMPLES) * Math.PI * 2,
          planet.center,
        ).position,
    );
    const continentShapes = buildContinentShapes(planet.radius, planet.center);
    const treePoints = scatterTrees(
      TREE_COUNT,
      planet.radius,
      planet.center,
    ).map((t) => t.position);

    return { boardsData, pathPoints, continentShapes, treePoints, planet };
  }, [items, planet]);
};

const drawBook = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
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

const drawContinents = (
  ctx: CanvasRenderingContext2D,
  shapes: ContinentShape[],
  toMap: AzimuthalProjection["toMap"],
  size: number,
) => {
  for (const shape of shapes) {
    // A landmass that straddles the antipodal singularity would self-
    // intersect if filled as one polygon - split it like the path and
    // fill each clean piece on its own (visually near-invisible in
    // practice, since it only bites right at the map's outer rim).
    const segments = projectPolyline(shape.points, toMap, size);
    ctx.fillStyle = shape.color;
    for (const segment of segments) {
      if (segment.length < 3) continue;
      ctx.beginPath();
      segment.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    }
  }
};

const drawTrees = (
  ctx: CanvasRenderingContext2D,
  treePoints: Vector3[],
  toMap: AzimuthalProjection["toMap"],
) => {
  ctx.fillStyle = "#2f6e3a";
  for (const p of treePoints) {
    const [x, y] = toMap(p);
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
};

interface DrawOptions {
  showTrees: boolean;
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
  const { requestAutopilot } = useAutopilot();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Bounding rect captured the instant before an expand/collapse toggle,
  // consumed by the FLIP effect below.
  const preToggleRectRef = useRef<DOMRect | null>(null);
  const size = useMapSize(containerRef);
  const { boardsData, pathPoints, continentShapes, treePoints, planet } =
    useMinimapWorldData();

  // The expanded view's single frozen snapshot - null while collapsed
  // (live) or before the first expand.
  const [frozenBoardPoints, setFrozenBoardPoints] = useState<
    { id: string; x: number; y: number }[]
  >([]);

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

      if (options.showTrees) drawTrees(ctx, treePoints, toMap);

      for (const board of boardsData) {
        const [x, y] = toMap(
          getBoardMatWorldPosition(board.position, board.quaternion),
        );
        drawBook(ctx, x, y);
      }

      void shipPosition;
      // The projection is centered on the ship by construction, so its
      // own marker always sits at the exact middle of the circle.
      drawShipArrow(ctx, drawSize / 2, drawSize / 2, shipBearing);
    },
    [continentShapes, pathPoints, treePoints, boardsData],
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
        draw(ctx, toMap, size, ship.position, bearing, { showTrees: false });
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
    const toMap = computeAzimuthalProjection(
      shipPosition,
      size,
      planet.center,
    ).toMap;
    const bearing = headingBearing(
      ship.quaternion,
      shipPosition,
      planet.center,
    );
    draw(ctx, toMap, size, shipPosition, bearing, { showTrees: true });

    setFrozenBoardPoints(
      boardsData.map((board) => {
        const [x, y] = toMap(
          getBoardMatWorldPosition(board.position, board.quaternion),
        );
        return { id: board.id, x, y };
      }),
    );
  }, [expanded, size, shipRef, planet, draw, boardsData]);

  // Both directions go through the same rect capture so the FLIP effect
  // below can animate the toggle as one continuous element resizing,
  // rather than an instant jump followed by a width/height tween.
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
    requestAutopilot(
      getBoardMatWorldPosition(board.position, board.quaternion),
    );
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
        <div className="minimap-compass">N</div>
        <canvas ref={canvasRef} />
        {expanded && (
          <>
            <button
              type="button"
              className="minimap-close"
              aria-label="Close map"
              onClick={collapse}
            >
              &times;
            </button>
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
