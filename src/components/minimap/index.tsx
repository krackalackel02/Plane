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
  computePlanetToMapProjection,
  headingBearing,
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
// enough that the wiggle (see pathFrameAt) reads as a smooth curve rather
// than a faceted polygon at minimap scale.
const PATH_SAMPLES = 180;

/**
 * The whole planet, unwrapped: an equirectangular map fits the entire
 * surface by construction, so - unlike the old flat minimap - this never
 * needs to re-fit itself to board positions or a world boundary.
 */
const usePlanetToMap = (size: number) => {
  const { items } = useProjects();
  const planet = getActivePlanet();

  return useMemo(() => {
    const boardsData = calculatedBoardPositionsAndRotations(items, planet);
    const projection = computePlanetToMapProjection(
      boardsData,
      size,
      planet.center,
    );

    // The actual trail, not a flat equator line - it wiggles (see
    // pathFrameAt), and this is the one and only path the map highlights;
    // segments split wherever the projection wraps around the map's left/
    // right edge, so the line never draws a spurious streak clear across
    // the canvas.
    const shellRadius = getShellRadius(planet);
    const rawPoints = Array.from({ length: PATH_SAMPLES + 1 }, (_, i) =>
      projection.toMap(
        pathFrameAt(
          shellRadius,
          (i / PATH_SAMPLES) * Math.PI * 2,
          planet.center,
        ).position,
      ),
    );
    const pathSegments: [number, number][][] = [];
    let current: [number, number][] = [];
    for (const point of rawPoints) {
      const previous = current[current.length - 1];
      if (previous && Math.abs(point[0] - previous[0]) > size / 2) {
        pathSegments.push(current);
        current = [];
      }
      current.push(point);
    }
    if (current.length > 1) pathSegments.push(current);

    return { ...projection, boardsData, planet, pathSegments };
  }, [items, planet, size]);
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

/**
 * GTA5-style minimap docked in the bottom-left corner: an equirectangular
 * "unwrapped planet" map, with a red arrow for the ship (rotates to match
 * its compass heading) and book icons for each project board - all on one
 * horizontal line across the middle, since every board sits on the
 * planet's equator (see calculatedBoardPositionsAndRotations). Flying that
 * line left-to-right, in order, is "how you see everything on this
 * planet" - and wrapping off one edge of the map back onto the other
 * reads exactly like flying off the edge of a world map, because that's
 * what it is.
 *
 * Tapping the dock expands it to a large, centered overlay (GTAV-style),
 * where each project icon becomes tappable: picking one engages autopilot
 * to that board and collapses the map back to its dock. Tapping the
 * backdrop, the close button, or Escape collapses it without flying
 * anywhere.
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
  const { boardPoints, boardsData, toMap, planet, pathSegments } =
    usePlanetToMap(size);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let frameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // The actual trail - the one path every board sits along and the
      // ship's usual cruise line - drawn as the map's single highlighted
      // line, matching the wiggly ring in the 3D scene rather than a flat
      // equator reference.
      ctx.strokeStyle = "rgba(125, 211, 252, 0.9)";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      for (const segment of pathSegments) {
        ctx.beginPath();
        segment.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      boardPoints.forEach(({ x, y }) => drawBook(ctx, x, y));

      const ship = shipRef.current;
      if (ship) {
        const [x, y] = toMap(ship.position);
        const bearing = headingBearing(
          ship.quaternion,
          ship.position,
          planet.center,
        );
        drawShipArrow(ctx, x, y, bearing);
      }

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [boardPoints, pathSegments, toMap, shipRef, size, planet]);

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
            {boardPoints.map(({ id, x, y }) => {
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
