import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { useScene } from "../../../../context/sceneContext";
import { useProjects } from "../../../../context/projectContext";
import { useAutopilot } from "../../../../context/autopilotContext";
import {
  boardVisualTransform,
  calculatedBoardPositionsAndRotations,
} from "../../../timeline/calculatedBoardPositionsAndRotations";
import boardGeometry from "../../../../utils/boardParams.json";
import { buildBoardObbs, resolveShipBoardCollision } from "./boardCollision";
import { getActivePlanet, getShellRadius } from "../../../../utils/planets";
import shipParams from "../../../../utils/shipParams.json";

// Restitution: how much of the incoming speed bounces back on impact -
// boards should feel like a real, springy knock.
const BOARD_RESTITUTION = 0.55;
// How much of a bounce impulse survives each frame - same "multiply every
// frame" decay convention the other motions use (see baseMotion.tsx).
const IMPULSE_DECAY = 0.88;
const MIN_IMPULSE = 0.001;

/**
 * Ship collision & bounce physics.
 *
 * Mounted after <Physics/> so it corrects whatever position the ship's own
 * key-driven motions (or autopilot) produced this frame: bounces the ship
 * off each project board's frame with real springiness, by applying a
 * decaying knockback impulse directly to position, then re-clamps the
 * result onto the planet's shell so a bounce can never knock the ship off
 * the surface it's meant to be flying just above.
 *
 * There's no world-boundary wall any more - unlike the old flat, bounded
 * "cylinder world", a planet's surface has no edge to hit; you just keep
 * flying around it.
 *
 * This only ever reads/writes shipRef.position. It never touches
 * keyContext or autopilotContext, so a bounce can never trigger the exhaust
 * jets (see ship/exhaust/index.tsx) - those react purely to held keys and
 * autopilot flight, not to how the ship's position actually moves.
 */
const ShipCollision = () => {
  const { shipRef } = useScene();
  const { items } = useProjects();
  const { isFlying } = useAutopilot();
  const planet = getActivePlanet();
  const shellRadius = getShellRadius(planet);

  const boardObbs = useMemo(() => {
    const boardsData = calculatedBoardPositionsAndRotations(items, planet);
    // Collide against where each board is actually rendered (offset off
    // the trail centerline - see board.tsx/timeline/index.tsx), not its
    // centerline anchor: the anchor is where the activation zone and the
    // ship's own flight path sit, so building the hitbox there instead
    // would bump the ship against a board that visually isn't even there.
    const visualBoards = boardsData.map((board, i) =>
      boardVisualTransform(board, i),
    );
    return buildBoardObbs(visualBoards, boardGeometry);
  }, [items, planet]);

  const prevPosition = useRef(new Vector3());
  const impulse = useRef(new Vector3());
  const initialized = useRef(false);

  const pushOutOfBoards = (ship: Group) => {
    for (const obb of boardObbs) {
      const hit = resolveShipBoardCollision(
        ship.position,
        ship.quaternion,
        shipParams.halfExtents,
        obb,
      );
      if (!hit) continue;
      ship.position.add(hit.pushOut);
    }
  };

  const snapToShell = (ship: Group) => {
    const normal = ship.position.clone().sub(planet.center).normalize();
    ship.position.copy(normal.multiplyScalar(shellRadius).add(planet.center));
  };

  useFrame(() => {
    const ship = shipRef.current;
    if (!ship) return;

    if (!initialized.current) {
      prevPosition.current.copy(ship.position);
      initialized.current = true;
      return;
    }

    // Autopilot flies a scripted path straight to a board's landing mat
    // (see AutopilotMotion) - trust its velocity entirely rather than
    // fighting it with knockback impulses, which could yank the ship off
    // its curve. It's still a great-circle arc though, not a real collision
    // check, so a tight route can graze a board's frame - keep applying the
    // position-only push-out (no impulse, so it can't perturb the curve)
    // every frame so that never reads as the ship clipping through solid
    // geometry.
    if (isFlying) {
      pushOutOfBoards(ship);
      snapToShell(ship);
      prevPosition.current.copy(ship.position);
      impulse.current.set(0, 0, 0);
      return;
    }

    // Apply last frame's bounce-back, then let it bleed off.
    ship.position.add(impulse.current);
    impulse.current.multiplyScalar(IMPULSE_DECAY);
    if (impulse.current.lengthSq() < MIN_IMPULSE * MIN_IMPULSE) {
      impulse.current.set(0, 0, 0);
    }

    const velocity = ship.position.clone().sub(prevPosition.current);

    for (const obb of boardObbs) {
      const hit = resolveShipBoardCollision(
        ship.position,
        ship.quaternion,
        shipParams.halfExtents,
        obb,
      );
      if (!hit) continue;

      ship.position.add(hit.pushOut);

      const velocityAlongNormal = velocity.dot(hit.normal);
      if (velocityAlongNormal < 0) {
        const bounce = -velocityAlongNormal * (1 + BOARD_RESTITUTION);
        impulse.current.addScaledVector(hit.normal, bounce);
      }
    }

    snapToShell(ship);
    prevPosition.current.copy(ship.position);
  });

  return null;
};

export default ShipCollision;
