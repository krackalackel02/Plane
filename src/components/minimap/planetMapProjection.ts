import { Quaternion, Vector3 } from "three";
import {
  eastNorthAt,
  forwardOf,
  surfaceNormal,
} from "../../utils/planetSurface";

export interface WorldPoint {
  id: string;
  position: [number, number, number];
}

export interface MapPoint {
  id: string;
  x: number;
  y: number;
}

export interface PlanetToMapProjection {
  toMap: (position: Vector3) => [number, number];
  boardPoints: MapPoint[];
}

/**
 * Latitude/longitude of a world point relative to a planet's center -
 * standard spherical coordinates matching planetSurface's pointOnSphere
 * convention (Y is the polar axis, longitude 0 on +Z, increasing toward +X).
 */
export const latLonOf = (
  position: Vector3,
  center: Vector3 = new Vector3(),
): { lat: number; lon: number } => {
  const normal = surfaceNormal(position, center);
  return {
    lat: Math.asin(Math.max(-1, Math.min(1, normal.y))),
    lon: Math.atan2(normal.x, normal.z),
  };
};

/**
 * Build a fixed equirectangular projection of the *entire* planet onto a
 * `size` x `size` square: longitude maps to x (wrapping around, since a
 * planet has no edge to pad a view against) and latitude to y, centered in
 * a horizontal band half the canvas's height (a standard 2:1 equirectangular
 * image inscribed in a square canvas). Unlike the old flat minimap, this
 * never needs to re-fit itself to board positions - the whole planet always
 * fits, by construction, and boards (all on the equator) form one clean
 * horizontal line straight across the middle: the "travel around it" path,
 * literally laid flat.
 *
 * North is screen-up and east is screen-right, same as any ordinary map -
 * no mirroring, unlike the old ship-relative flat minimap - since this
 * reads as a fixed world map rather than a chase-cam view.
 */
export const computePlanetToMapProjection = (
  boards: WorldPoint[],
  size: number,
  center: Vector3 = new Vector3(),
): PlanetToMapProjection => {
  const toMap = (position: Vector3): [number, number] => {
    const { lat, lon } = latLonOf(position, center);
    const lonNormalized = (lon + Math.PI * 2) % (Math.PI * 2);
    const x = (lonNormalized / (Math.PI * 2)) * size;
    const y = size / 2 - (lat / (Math.PI / 2)) * (size / 4);
    return [x, y];
  };

  const boardPoints: MapPoint[] = boards.map((b) => {
    const [x, y] = toMap(new Vector3(...b.position));
    return { id: b.id, x, y };
  });

  return { toMap, boardPoints };
};

/**
 * Compass bearing (radians, 0 = north, increasing clockwise like a real
 * compass) of a ship's forward direction at a given surface position -
 * the rotation to apply to an up-pointing arrow glyph so it matches the
 * ship's heading on the equirectangular map.
 *
 * Flattening a 3D heading onto a lat/lon map isn't just "read off the yaw"
 * once the ship can be anywhere on a sphere (not just standing at a fixed
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
