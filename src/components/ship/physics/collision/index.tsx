import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { useScene } from "../../../../context/sceneContext";
import { useProjects } from "../../../../context/projectContext";
import { useAutopilot } from "../../../../context/autopilotContext";
import { useBoundary } from "../../../../context/boundaryContext";
import { useWorldBounds } from "../../../../utils/worldBounds";
import { calculatedBoardPositionsAndRotations } from "../../../timeline/calculatedBoardPositionsAndRotations";
import boardGeometry from "../../../../utils/boardParams.json";
import { buildBoardObbs, resolveCircleObb } from "./boardCollision";
import { clampToBounds } from "./boundaryCollision";

// Restitution: how much of the incoming speed bounces back on impact.
// Walls are the edge of the playable zone - they should feel like a hard
// stop, not a trampoline. Boards should feel like a real, springy knock.
const WALL_RESTITUTION = 0.08;
const BOARD_RESTITUTION = 0.55;
// How much of a bounce impulse survives each frame - same "multiply every
// frame" decay convention the other motions use (see baseMotion.tsx).
const IMPULSE_DECAY = 0.88;
const MIN_IMPULSE = 0.001;
// Ship-as-a-circle radius for collision purposes, roughly its half-length
// (see the {x:5,y:3,z:2} scale target in ship/index.tsx).
const SHIP_RADIUS = 2;

/**
 * Ship collision & bounce physics.
 *
 * Mounted after <Physics/> so it corrects whatever position the ship's own
 * key-driven motions (or autopilot) produced this frame:
 * - clamps the ship inside the world boundary (utils/worldBounds) with
 *   almost no bounce, like a wall.
 * - bounces the ship off each project board's frame with real springiness,
 *   by applying a decaying knockback impulse directly to position.
 *
 * This only ever reads/writes shipRef.position (plus boundaryContext's
 * isOutOfZone flag, an on/off warning light). It never touches keyContext
 * or autopilotContext, so a bounce can never trigger the exhaust jets
 * (see ship/exhaust/index.tsx) - those react purely to held keys and
 * autopilot flight, not to how the ship's position actually moves.
 */
const ShipCollision = () => {
  const { shipRef } = useScene();
  const { items } = useProjects();
  const { isFlying } = useAutopilot();
  const { setIsOutOfZone } = useBoundary();
  const bounds = useWorldBounds();

  const boardObbs = useMemo(() => {
    const boardsData = calculatedBoardPositionsAndRotations(items, "arc");
    return buildBoardObbs(boardsData, boardGeometry);
  }, [items]);

  const prevPosition = useRef(new Vector3());
  const impulse = useRef({ x: 0, z: 0 });
  const initialized = useRef(false);

  const pushOutOfBoards = (ship: Group) => {
    for (const obb of boardObbs) {
      const hit = resolveCircleObb(
        { x: ship.position.x, z: ship.position.z },
        obb,
        SHIP_RADIUS,
      );
      if (!hit) continue;
      ship.position.x += hit.pushOut.x;
      ship.position.z += hit.pushOut.z;
    }
  };

  useFrame(() => {
    const ship = shipRef.current;
    if (!ship) return;

    if (!initialized.current) {
      prevPosition.current.copy(ship.position);
      initialized.current = true;
      return;
    }

    // Autopilot flies a scripted, obstacle-avoiding path straight to a
    // board's landing mat (see AutopilotMotion) - trust its velocity
    // entirely rather than fighting it with knockback impulses or wall
    // clamping, which could yank the ship off its curve. It's still a
    // straight-line/two-leg path though, not a real collision check, so a
    // tight route can graze a board's frame - keep applying the
    // position-only push-out (no impulse, so it can't perturb the curve)
    // every frame so that never reads as the ship clipping through solid
    // geometry.
    if (isFlying) {
      pushOutOfBoards(ship);
      prevPosition.current.copy(ship.position);
      impulse.current = { x: 0, z: 0 };
      setIsOutOfZone(false);
      return;
    }

    // Apply last frame's bounce-back, then let it bleed off.
    ship.position.x += impulse.current.x;
    ship.position.z += impulse.current.z;
    impulse.current.x *= IMPULSE_DECAY;
    impulse.current.z *= IMPULSE_DECAY;
    if (Math.abs(impulse.current.x) < MIN_IMPULSE) impulse.current.x = 0;
    if (Math.abs(impulse.current.z) < MIN_IMPULSE) impulse.current.z = 0;

    const velocity = {
      x: ship.position.x - prevPosition.current.x,
      z: ship.position.z - prevPosition.current.z,
    };

    // --- Boundary wall: hard stop, little to no bounce. ---
    const wall = clampToBounds(
      { x: ship.position.x, z: ship.position.z },
      bounds,
    );
    ship.position.x = wall.position.x;
    ship.position.z = wall.position.z;
    let pushingOnWall = false;
    if (wall.hit) {
      const velocityAlongNormal =
        velocity.x * wall.outwardNormal.x + velocity.z * wall.outwardNormal.z;
      if (velocityAlongNormal > 0) {
        pushingOnWall = true;
        const bounce = velocityAlongNormal * (1 + WALL_RESTITUTION);
        impulse.current.x -= bounce * wall.outwardNormal.x;
        impulse.current.z -= bounce * wall.outwardNormal.z;
      }
    }
    setIsOutOfZone(pushingOnWall);

    // --- Boards: springy knockback. ---
    for (const obb of boardObbs) {
      const hit = resolveCircleObb(
        { x: ship.position.x, z: ship.position.z },
        obb,
        SHIP_RADIUS,
      );
      if (!hit) continue;

      ship.position.x += hit.pushOut.x;
      ship.position.z += hit.pushOut.z;

      const velocityAlongNormal =
        velocity.x * hit.normal.x + velocity.z * hit.normal.z;
      if (velocityAlongNormal < 0) {
        const bounce = -velocityAlongNormal * (1 + BOARD_RESTITUTION);
        impulse.current.x += bounce * hit.normal.x;
        impulse.current.z += bounce * hit.normal.z;
      }
    }

    prevPosition.current.copy(ship.position);
  });

  return null;
};

export default ShipCollision;
