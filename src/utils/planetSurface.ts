import { Matrix4, Quaternion, Vector3 } from "three";

const WORLD_UP = new Vector3(0, 1, 0);

/** Outward surface normal at a world position relative to a planet center. */
export const surfaceNormal = (
  position: Vector3,
  center: Vector3 = new Vector3(0, 0, 0),
): Vector3 => position.clone().sub(center).normalize();

/**
 * Point on a sphere given latitude/longitude in radians, with Y as the
 * polar axis. Longitude 0 sits on +Z and increases toward +X, matching the
 * old flat-world TranslationMotion's (sin(yaw), cos(yaw)) forward
 * convention so a heading of 0 still reads as "toward +Z".
 */
export const pointOnSphere = (
  radius: number,
  lat: number,
  lon: number,
  center: Vector3 = new Vector3(0, 0, 0),
): Vector3 =>
  new Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  ).add(center);

/** Re-project an arbitrary point onto a sphere shell of the given radius. */
export const projectToShell = (
  position: Vector3,
  radius: number,
  center: Vector3 = new Vector3(0, 0, 0),
): Vector3 =>
  surfaceNormal(position, center).multiplyScalar(radius).add(center);

/**
 * Build an orientation whose local +Y is `up` and local +Z is
 * `forwardHint` flattened against `up` (it doesn't need to already be
 * tangent). Local +X is the remaining right-handed axis. Matches the
 * ship's existing convention where an unrotated group's forward is +Z.
 */
export const buildSurfaceOrientation = (
  up: Vector3,
  forwardHint: Vector3,
): Quaternion => {
  const y = up.clone().normalize();
  const z = forwardHint.clone().projectOnPlane(y);
  if (z.lengthSq() < 1e-8) {
    // forwardHint was parallel to up - fall back to any vector
    // perpendicular to up so the basis is still well defined.
    z.copy(
      Math.abs(y.y) < 0.99
        ? WORLD_UP.clone().projectOnPlane(y)
        : new Vector3(1, 0, 0).projectOnPlane(y),
    );
  }
  z.normalize();
  const x = new Vector3().crossVectors(y, z).normalize();
  // Recompute z from x/y to guarantee strict orthogonality.
  z.crossVectors(x, y).normalize();

  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(x, y, z),
  );
};

/**
 * Rotate `orientation` by the minimal rotation that carries its current
 * local up axis onto `normal`, leaving its heading as close to unchanged
 * as the new surface allows. This is the standard "walk on a sphere"
 * parallel-transport trick: applying it every frame after moving keeps
 * turning and driving forward composing correctly anywhere on the planet,
 * without ever needing to track latitude/longitude explicitly.
 */
export const alignOrientationToNormal = (
  orientation: Quaternion,
  normal: Vector3,
): Quaternion => {
  const currentUp = new Vector3(0, 1, 0).applyQuaternion(orientation);
  const align = new Quaternion().setFromUnitVectors(currentUp, normal);
  return align.multiply(orientation);
};

export const forwardOf = (orientation: Quaternion): Vector3 =>
  new Vector3(0, 0, 1).applyQuaternion(orientation);

export const upOf = (orientation: Quaternion): Vector3 =>
  new Vector3(0, 1, 0).applyQuaternion(orientation);

/**
 * Tangent compass directions at a surface point: `east` points in the
 * direction of increasing longitude, `north` toward increasing latitude.
 * Used to flatten a 3D heading onto the equirectangular minimap.
 */
export const eastNorthAt = (normal: Vector3) => {
  const east = new Vector3(normal.z, 0, -normal.x);
  if (east.lengthSq() < 1e-8) east.set(1, 0, 0); // at a pole - pick arbitrarily
  east.normalize();
  const north = new Vector3().crossVectors(normal, east).normalize();
  return { east, north };
};

/** Angle in radians between two directions (need not be unit length). */
export const angleBetween = (a: Vector3, b: Vector3): number => {
  const ua = a.clone().normalize();
  const ub = b.clone().normalize();
  return Math.acos(Math.max(-1, Math.min(1, ua.dot(ub))));
};

/**
 * Spherical linear interpolation between two directions (need not be unit
 * length - only their directions matter), returned as a unit vector. Used
 * to fly a great-circle arc between two points on a sphere shell: every
 * point produced sits at exactly the same distance from the origin as the
 * inputs' direction, so - unlike lerping the raw positions - the path can
 * never dip inside the shell.
 */
export const slerpOnSphere = (a: Vector3, b: Vector3, t: number): Vector3 => {
  const ua = a.clone().normalize();
  const ub = b.clone().normalize();
  const dot = Math.max(-1, Math.min(1, ua.dot(ub)));
  const theta = Math.acos(dot);
  if (theta < 1e-6) return ua;
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return ua.multiplyScalar(wa).add(ub.multiplyScalar(wb)).normalize();
};
