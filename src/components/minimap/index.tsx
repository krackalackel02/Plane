import { useEffect, useMemo, useRef } from "react";
import { useScene } from "../../context/sceneContext";
import { useProjects } from "../../context/projectContext";
import { calculatedBoardPositionsAndRotations } from "../timeline/calculatedBoardPositionsAndRotations";
import {
  arrowRotationForYaw,
  computeWorldToMapProjection,
} from "./mapProjection";
import "./minimap.css";

// CSS pixel size of the map's drawing surface - actual canvas backing
// store is this times devicePixelRatio, set once in the draw effect.
const SIZE = 200;
// Fraction of the map reserved as empty margin around the world bounds,
// so board icons/the ship arrow never touch the rim.
const PADDING_RATIO = 0.22;

/**
 * Project world (x, z) coordinates onto the map's fixed CSS-pixel space.
 * The map does not pan or rotate with the ship - it is scaled once to
 * fit the whole timeline arc plus the ship's origin, GTA5-style "whole
 * area" minimap rather than a close-up chase view.
 */
const useWorldToMap = () => {
  const { items } = useProjects();

  return useMemo(() => {
    const boardsData = calculatedBoardPositionsAndRotations(items, "arc");
    return computeWorldToMapProjection(boardsData, SIZE, PADDING_RATIO);
  }, [items]);
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
 */
const Minimap = () => {
  const { shipRef } = useScene();
  const { boardPoints, toMap } = useWorldToMap();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    let frameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Range rings, purely decorative.
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      [0.33, 0.66, 1].forEach((f) => {
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, (SIZE / 2 - 4) * f, 0, Math.PI * 2);
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
  }, [boardPoints, toMap, shipRef]);

  return (
    <div className="minimap" aria-hidden="true">
      <div className="minimap-compass">N</div>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default Minimap;
