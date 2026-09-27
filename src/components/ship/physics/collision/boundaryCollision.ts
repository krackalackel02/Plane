import { WorldBounds } from "../../../../utils/worldBounds";

export interface Vec2 {
  x: number;
  z: number;
}

export interface BoundaryClamp {
  position: Vec2;
  hit: boolean;
  // Unit vector pointing radially outward from the boundary's center at
  // the clamp point. Only meaningful when `hit` is true.
  outwardNormal: Vec2;
}

/**
 * Clamps a position inside the world boundary circle (see
 * utils/worldBounds), reporting the outward radial normal at the contact
 * point when a clamp happened, so the caller can decide how much of the
 * incoming speed to bounce back.
 */
export const clampToBounds = (
  position: Vec2,
  bounds: WorldBounds,
): BoundaryClamp => {
  const dx = position.x - bounds.centerX;
  const dz = position.z - bounds.centerZ;
  const dist = Math.hypot(dx, dz);

  if (dist <= bounds.radius) {
    return { position, hit: false, outwardNormal: { x: 0, z: 0 } };
  }

  const outwardNormal = { x: dx / dist, z: dz / dist };
  return {
    position: {
      x: bounds.centerX + outwardNormal.x * bounds.radius,
      z: bounds.centerZ + outwardNormal.z * bounds.radius,
    },
    hit: true,
    outwardNormal,
  };
};
