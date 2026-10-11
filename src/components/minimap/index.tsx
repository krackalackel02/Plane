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
import { buildMapRelief } from "./mapRelief";
import {
  CANOPY_RADIUS,
  drawCanopy,
  drawDesertRelief,
  drawLandmasses,
  drawRidges,
  projectPolyline,
} from "./drawTerrain";
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

// How finely the trail is sampled for the minimap's own path line - dense
// enough to read as a smooth curve at minimap scale.
const PATH_SAMPLES = 180;
// Enough to keep the autopilot arc smooth even across half the planet.
const ROUTE_SAMPLES = 96;

const OCEAN = "#1c6bc2";

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
    // The terrain as relief - built from the same terrain and props the 3D
    // scene renders, so the map shows the real ground, not a separate
    // approximation of it.
    const relief = buildMapRelief(planet.radius, planet.center);

    return { boardsData, pathPoints, relief, planet };
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
  // Open-book silhouette: two pages meeting at a center spine - lifted off
  // the terrain by a soft shadow, so the projects stay the map's top layer
  // however busy the relief beneath them gets.
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.beginPath();
  ctx.moveTo(0, -3.5);
  ctx.lineTo(-6, -5.5);
  ctx.lineTo(-6, 4.5);
  ctx.lineTo(0, 6.5);
  ctx.lineTo(6, 4.5);
  ctx.lineTo(6, -5.5);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = "transparent";
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

interface DrawOptions {
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
 * you're trying to click something), its relief drawn at the larger size. Picking a project marker engages autopilot to that
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
  const { boardsData, pathPoints, relief, planet } = useMinimapWorldData();

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
      ctx.fillStyle = OCEAN;
      ctx.fillRect(0, 0, drawSize, drawSize);

      // Strokes and glyphs grow with the map, gently - the expanded map has
      // more room for detail, not just fatter lines.
      const px = Math.sqrt(drawSize / COLLAPSED_SIZE);
      // Map pixels per world unit along the surface: the projection keeps
      // true distance from the centre, the whole sphere fitting in the
      // radius (see planetMapProjection.ts).
      const unitPx = drawSize / 2 / (Math.PI * planet.radius);

      drawLandmasses(ctx, relief.landmasses, toMap, drawSize, px);
      drawCanopy(ctx, relief.canopy, toMap, CANOPY_RADIUS * unitPx, px);
      drawDesertRelief(ctx, relief.desert, toMap, drawSize, px);
      drawRidges(ctx, relief.ridges, toMap, drawSize, unitPx, px);

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
    [relief, pathPoints, boardsData, planet],
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
          autopilotTarget: autopilotRouteRef.current ?? undefined,
        });
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [expanded, size, shipRef, planet, draw]);

  // Expanded: one frozen snapshot, centered on wherever the ship was the
  // moment it opened - drawn once (not per-frame), with matching frozen
  // marker positions for the clickable overlay below.
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
    draw(ctx, toMap, size, shipPosition, bearing, {});

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
