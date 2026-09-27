import { WorldBounds } from "../../../../utils/worldBounds";

export interface Vec2 {
  x: number;
  z: number;
}

/**
 * Which side of an axis's range was crossed: -1 = the min side, 1 = the
 * max side, 0 = still inside.
 */
export type AxisHit = -1 | 0 | 1;

export interface BoundaryClamp {
  position: Vec2;
  hitX: AxisHit;
  hitZ: AxisHit;
}

/**
 * Clamps a position inside the world boundary rectangle, independently per
 * axis, reporting which wall (if any) was hit on each axis so the caller
 * can decide how much of the incoming speed to bounce back.
 */
export const clampToBounds = (
  position: Vec2,
  bounds: WorldBounds,
): BoundaryClamp => {
  let x = position.x;
  let hitX: AxisHit = 0;
  if (x < bounds.minX) {
    x = bounds.minX;
    hitX = -1;
  } else if (x > bounds.maxX) {
    x = bounds.maxX;
    hitX = 1;
  }

  let z = position.z;
  let hitZ: AxisHit = 0;
  if (z < bounds.minZ) {
    z = bounds.minZ;
    hitZ = -1;
  } else if (z > bounds.maxZ) {
    z = bounds.maxZ;
    hitZ = 1;
  }

  return { position: { x, z }, hitX, hitZ };
};
