import { Vector3 } from "three";
import { pointOnSphere } from "../../utils/planetSurface";

export interface LandBlob {
  lon: number; // radians, planetSurface's pointOnSphere convention
  lat: number; // radians
  radius: number; // radians, angular radius of this sub-blob
}

export interface Continent {
  blobs: LandBlob[];
}

const deg = (d: number): number => (d * Math.PI) / 180;

/**
 * Hand-authored landmasses, loosely spread around the globe and kept off
 * the poles (where an equirectangular texture badly distorts a round
 * blob). Each continent is a small cluster of overlapping circular
 * sub-blobs so the silhouette reads as an organic landmass rather than a
 * single disc - both the surface texture (planetTexture.ts) and the tree
 * scatter (treePositions below) read from this one list, so foliage never
 * ends up floating over open ocean.
 */
export const CONTINENTS: Continent[] = [
  {
    blobs: [
      { lon: deg(15), lat: deg(28), radius: deg(16) },
      { lon: deg(32), lat: deg(18), radius: deg(12) },
      { lon: deg(8), lat: deg(8), radius: deg(10) },
    ],
  },
  {
    blobs: [
      { lon: deg(95), lat: deg(-10), radius: deg(14) },
      { lon: deg(112), lat: deg(4), radius: deg(11) },
    ],
  },
  {
    blobs: [
      { lon: deg(162), lat: deg(35), radius: deg(10) },
      { lon: deg(177), lat: deg(22), radius: deg(9) },
    ],
  },
  {
    blobs: [
      { lon: deg(-140), lat: deg(-18), radius: deg(13) },
      { lon: deg(-156), lat: deg(-4), radius: deg(10) },
      { lon: deg(-128), lat: deg(-32), radius: deg(9) },
    ],
  },
  {
    blobs: [
      { lon: deg(-58), lat: deg(16), radius: deg(11) },
      { lon: deg(-44), lat: deg(-6), radius: deg(9) },
    ],
  },
  {
    blobs: [{ lon: deg(-8), lat: deg(-36), radius: deg(9) }],
  },
  {
    blobs: [
      { lon: deg(55), lat: deg(48), radius: deg(9) },
      { lon: deg(68), lat: deg(38), radius: deg(8) },
    ],
  },
];

const allBlobs = (): LandBlob[] => CONTINENTS.flatMap((c) => c.blobs);

const wrapDelta = (d: number): number => {
  const twoPi = Math.PI * 2;
  let x = d % twoPi;
  if (x > Math.PI) x -= twoPi;
  if (x < -Math.PI) x += twoPi;
  return x;
};

/**
 * Cheap angular distance between two lon/lat points, flattened by a
 * cos(lat) longitude correction - accurate enough at these blob radii (a
 * few tens of degrees at most) without the cost of full haversine, and
 * this gets sampled a lot during tree placement's rejection sampling.
 */
const angularDistance = (
  lonA: number,
  latA: number,
  lonB: number,
  latB: number,
): number => {
  const dLon = wrapDelta(lonA - lonB) * Math.cos((latA + latB) / 2);
  const dLat = latA - latB;
  return Math.sqrt(dLon * dLon + dLat * dLat);
};

/** Whether a lon/lat point (radians) falls inside any landmass blob. */
export const isLand = (lon: number, lat: number): boolean =>
  allBlobs().some((b) => angularDistance(lon, lat, b.lon, b.lat) < b.radius);

/**
 * Equirectangular UV matching three.js's SphereGeometry default UV unwrap
 * exactly (derived from its vertex formula: x=-r*cos(phi)*sin(theta),
 * y=r*cos(theta), z=r*sin(phi)*sin(theta), u=phi/2pi, v=theta/pi), so a
 * texture painted from lon/lat via this mapping lines up with the geometry
 * without needing lon=0 to mean anything in particular on-screen - only
 * self-consistency between the two matters.
 */
export const lonLatToUV = (lon: number, lat: number): [number, number] => {
  const u = (((lon / (Math.PI * 2) + 0.25) % 1) + 1) % 1;
  const v = 0.5 - lat / Math.PI;
  return [u, v];
};

export interface ScatteredTree {
  position: Vector3;
  normal: Vector3;
  /** Deterministic 0..1 draw, stable across re-renders for the same index. */
  seed: number;
}

const seededRandom = (n: number): number => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Deterministic tree scatter: rejection-samples lon/lat points against
 * isLand so every tree lands on a continent, never floating over open
 * ocean. Pure function of `count`/`radius`/`center` (no live randomness),
 * so it's stable across re-renders and safe to memoize on those alone.
 */
export const scatterTrees = (
  count: number,
  radius: number,
  center: Vector3,
): ScatteredTree[] => {
  const trees: ScatteredTree[] = [];
  let attempt = 0;
  // Bounded attempts, not a while(trees.length<count), so a pathological
  // CONTINENTS edit (e.g. all radius 0) can't spin this forever.
  const maxAttempts = count * 40;

  while (trees.length < count && attempt < maxAttempts) {
    const a = attempt++;
    const lon = (seededRandom(a * 2 + 1) - 0.5) * Math.PI * 2;
    const lat = (seededRandom(a * 2 + 2) - 0.5) * Math.PI * 0.9;
    if (!isLand(lon, lat)) continue;

    const position = pointOnSphere(radius, lat, lon, center);
    const normal = position.clone().sub(center).normalize();
    trees.push({ position, normal, seed: seededRandom(a * 7.13) });
  }

  return trees;
};
