import { Quaternion, Vector3 } from "three";
import {
  eastNorthAt,
  forwardOf,
  surfaceNormal,
} from "../../utils/planetSurface";

export interface AzimuthalProjection {
  toMap: (position: Vector3) => [number, number];
  // Exact inverse of toMap, at a given target radius from planetCenter -
  // lets a click anywhere on the map (not just a board marker) resolve to
  // a real world position to fly to.
  toWorld: (x: number, y: number, targetRadius: number) => Vector3;
}

/**
 * Azimuthal equidistant projection of the *entire* planet's surface onto a
 * `size` x `size` circle, centered on `centerPosition` (the ship): the
 * point directly at the center maps to the middle of the circle, distance
 * from the center on the map is exactly proportional to true angular
 * distance on the sphere, and the point on the exact opposite side of the
 * planet maps to the circle's outer rim - so unlike a simple "look straight
 * down" orthographic view, the whole sphere is always represented
 * somewhere on the map, not just the near hemisphere.
 *
 * North is map-up and east is map-right (standard compass layout, no
 * mirroring) - the ship stays pinned at the center and everything else
 * (terrain, boards, the trail) slides/rotates around it as it moves,
 * exactly like a radar.
 */
export const computeAzimuthalProjection = (
  centerPosition: Vector3,
  size: number,
  planetCenter: Vector3 = new Vector3(),
): AzimuthalProjection => {
  const centerNormal = surfaceNormal(centerPosition, planetCenter);
  const { east, north } = eastNorthAt(centerNormal);
  const mapRadius = size / 2;

  const toMap = (position: Vector3): [number, number] => {
    const direction = surfaceNormal(position, planetCenter);
    const cosTheta = Math.max(-1, Math.min(1, centerNormal.dot(direction)));
    const theta = Math.acos(cosTheta);
    // east/north are orthogonal to centerNormal by construction, so their
    // dot with `direction` picks out exactly its tangential (bearing)
    // component regardless of how far `direction` also points along
    // centerNormal - the same technique headingBearing below uses.
    const bearing = Math.atan2(direction.dot(east), direction.dot(north));
    const r = (theta / Math.PI) * mapRadius;
    return [
      mapRadius + r * Math.sin(bearing),
      mapRadius - r * Math.cos(bearing),
    ];
  };

  const toWorld = (x: number, y: number, targetRadius: number): Vector3 => {
    const dx = x - mapRadius;
    const dy = mapRadius - y;
    const r = Math.min(mapRadius, Math.hypot(dx, dy));
    const bearing = Math.atan2(dx, dy);
    const theta = (r / mapRadius) * Math.PI;
    const direction = centerNormal
      .clone()
      .multiplyScalar(Math.cos(theta))
      .addScaledVector(east, Math.sin(theta) * Math.sin(bearing))
      .addScaledVector(north, Math.sin(theta) * Math.cos(bearing))
      .normalize();
    return planetCenter.clone().addScaledVector(direction, targetRadius);
  };

  return { toMap, toWorld };
};

/**
 * Compass bearing (radians, 0 = north, increasing clockwise like a real
 * compass) of a ship's forward direction at a given surface position -
 * the rotation to apply to an up-pointing arrow glyph so it matches the
 * ship's heading on the map.
 *
 * Flattening a 3D heading onto a 2D map isn't just "read off the yaw" once
 * the ship can be anywhere on a sphere (not just standing at a fixed
 * orientation relative to one fixed world axis) - it has to go through the
 * local east/north tangent basis at the ship's actual position.
 */
export const headingBearing = (
  quaternion: Quaternion,
  position: Vector3,
  center: Vector3 = new Vector3(),
): number => {
  const normal = surfaceNormal(position, center);
  const { east, north } = eastNorthAt(normal);
  const forward = forwardOf(quaternion);
  const dEast = forward.dot(east);
  const dNorth = forward.dot(north);
  return Math.atan2(dEast, dNorth);
};
