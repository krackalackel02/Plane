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
  computeArcRadius,
} from "../timeline/calculatedBoardPositionsAndRotations";
import { getBoardMatWorldPosition } from "../../utils/3d";
import {
  arrowRotationForYaw,
  computeWorldToMapProjection,
} from "./mapProjection";
import "./minimap.css";

// CSS pixel size of the map's drawing surface when collapsed - actual
// canvas backing store is this times devicePixelRatio. The expanded size
// is driven by CSS (see minimap.css) and measured live, see useMapSize.
const COLLAPSED_SIZE = 200;
// Fraction of the map reserved as empty margin around the world bounds,
// so board icons/the ship arrow never touch the rim.
const PADDING_RATIO = 0.22;

/**
 * Track the minimap's actual rendered box size in CSS pixels. Collapsed
 * vs. expanded sizing lives entirely in CSS (including the mobile media
 * query), so rather than duplicating those breakpoints in JS, a
 * ResizeObserver reports whatever size the box ends up at - the world-to
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

/**
 * Project world (x, z) coordinates onto the map's CSS-pixel space. The map
 * does not pan or rotate with the ship - it is scaled once to fit the
 * whole timeline arc plus the ship's origin, GTA5-style "whole area"
 * minimap rather than a close-up chase view. `size` is re-derived from
 * the live rendered box (see useMapSize) so the same projection serves
 * both the collapsed dock and the expanded, tappable overlay.
 */
const useWorldToMap = (size: number) => {
  const { items } = useProjects();

  return useMemo(() => {
    const boardsData = calculatedBoardPositionsAndRotations(items, "arc");
    const arcRadius = computeArcRadius(items.length);
    const projection = computeWorldToMapProjection(
      boardsData,
      size,
      PADDING_RATIO,
    );
    return { ...projection, boardsData, arcRadius };
  }, [items, size]);
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
  yaw: number,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(arrowRotationForYaw(yaw));
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
 * GTA5-style minimap docked in the bottom-left corner: a fixed-scale
 * top-down view of the whole timeline arc, with a red arrow for the ship
 * (rotates to match heading) and book icons for each project board.
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
  const { boardPoints, boardsData, toMap, arcRadius } = useWorldToMap(size);

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

      // Range rings, purely decorative.
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      [0.33, 0.66, 1].forEach((f) => {
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, (size / 2 - 4) * f, 0, Math.PI * 2);
        ctx.stroke();
      });

      boardPoints.forEach(({ x, y }) => drawBook(ctx, x, y));

      const ship = shipRef.current;
      if (ship) {
        const [x, y] = toMap(ship.position.x, ship.position.z);
        drawShipArrow(ctx, x, y, ship.rotation.y);
      }

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [boardPoints, toMap, shipRef, size]);

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
      getBoardMatWorldPosition(board.position, board.rotation[1]),
      arcRadius,
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
