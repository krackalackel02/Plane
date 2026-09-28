import { Vector3 } from "three";
import {
  eastNorthAt,
  pointOnSphere,
  surfaceNormal,
} from "../../utils/planetSurface";

export interface OutlineHarmonic {
  amplitude: number;
  freq: number;
  phase: number;
}

export interface ContinentDef {
  lon: number; // radians, centroid - planetSurface's pointOnSphere convention
  lat: number;
  /** Average outline radius, in world units (arc length at the centroid). */
  baseRadius: number;
  /** Summed sine wobble on top of baseRadius - what turns a circle into an organic, wavy-coastline landmass silhouette. */
  harmonics: OutlineHarmonic[];
  /** A smaller inset "highland" cap (tan, stacked on the green layer) - only the biggest landmasses get one, matching the reference art's single desert-toned continent. */
  highland?: { scale: number };
}

const deg = (d: number): number => (d * Math.PI) / 180;

/**
 * Hand-authored continents, loosely spread around the globe and kept off
 * the poles (where these local tangent-plane approximations get less
 * accurate). Each is a single organic landmass - a base radius wobbled by
 * a few sine harmonics - rather than a cluster of separate circular blobs,
 * so it reads as one continent with a wavy coastline (see outlineRadiusAt)
 * instead of several overlapping discs.
 */
export const CONTINENTS: ContinentDef[] = [
  {
    lon: deg(20),
    lat: deg(8),
    baseRadius: 15,
    harmonics: [
      { amplitude: 0.22, freq: 2, phase: 0.4 },
      { amplitude: 0.15, freq: 3, phase: 2.1 },
      { amplitude: 0.1, freq: 5, phase: 1.0 },
    ],
    highland: { scale: 0.5 },
  },
  {
    lon: deg(-100),
    lat: deg(32),
    baseRadius: 11,
    harmonics: [
      { amplitude: 0.25, freq: 2, phase: 1.2 },
      { amplitude: 0.14, freq: 4, phase: 0.3 },
    ],
  },
  {
    lon: deg(160),
    lat: deg(28),
    baseRadius: 9,
    harmonics: [
      { amplitude: 0.2, freq: 3, phase: 2.6 },
      { amplitude: 0.12, freq: 5, phase: 0.7 },
    ],
  },
  {
    lon: deg(-140),
    lat: deg(-20),
    baseRadius: 10,
    harmonics: [
      { amplitude: 0.24, freq: 2, phase: 0.1 },
      { amplitude: 0.13, freq: 4, phase: 1.8 },
    ],
  },
  {
    lon: deg(-55),
    lat: deg(5),
    baseRadius: 9.5,
    harmonics: [
      { amplitude: 0.22, freq: 2, phase: 2.0 },
      { amplitude: 0.14, freq: 3, phase: 0.9 },
    ],
  },
  {
    lon: deg(-8),
    lat: deg(-38),
    baseRadius: 8,
    harmonics: [
      { amplitude: 0.2, freq: 3, phase: 1.4 },
      { amplitude: 0.12, freq: 4, phase: 2.4 },
    ],
  },
  {
    lon: deg(60),
    lat: deg(45),
    baseRadius: 7.5,
    harmonics: [
      { amplitude: 0.2, freq: 2, phase: 0.8 },
      { amplitude: 0.15, freq: 4, phase: 2.9 },
    ],
  },
];

/** The wobbled outline radius (world units) at a given bearing (radians) around a continent's own centroid. */
export const outlineRadiusAt = (c: ContinentDef, bearing: number): number =>
  c.baseRadius *
  (1 +
    c.harmonics.reduce(
      (sum, h) => sum + h.amplitude * Math.sin(h.freq * bearing + h.phase),
      0,
    ));

// Extruded terrain heights (world units, above the ocean shell) and how far
// each layer's rim embeds into the one below it, hiding the seam - shared
// between the actual mesh builder (landmass.tsx) and heightAt below so a
// tree placed via heightAt always lands exactly on the surface the mesh
// itself renders, never floating above or clipping into it.
export const GREEN_HEIGHT = 1.5;
export const TAN_HEIGHT = 0.9;
export const TERRAIN_EMBED = 0.1;
/** Where a highland layer's own local z=0 should land, in the green layer's height space - see landmass.tsx. */
export const TAN_BASE_Z_OFFSET = GREEN_HEIGHT - TERRAIN_EMBED;
const GREEN_TOP_HEIGHT = GREEN_HEIGHT - TERRAIN_EMBED;
const TAN_TOP_HEIGHT = GREEN_TOP_HEIGHT - TERRAIN_EMBED + TAN_HEIGHT;

/**
 * This point's tangent-plane offset (world units, east/north) from a
 * continent's own centroid - a small-angle flat approximation, accurate
 * enough at these continent sizes (a few tens of degrees at most).
 */
const tangentOffsetOf = (
  planetRadius: number,
  center: Vector3,
  c: ContinentDef,
  lon: number,
  lat: number,
): { east: number; north: number } => {
  const centroidPos = pointOnSphere(planetRadius, c.lat, c.lon, center);
  const normal = surfaceNormal(centroidPos, center);
  const { east, north } = eastNorthAt(normal);
  const delta = pointOnSphere(planetRadius, lat, lon, center).sub(centroidPos);
  return { east: delta.dot(east), north: delta.dot(north) };
};

/**
 * Terrain height (world units above the ocean shell) at a given lon/lat -
 * 0 over open ocean, GREEN_TOP_HEIGHT over a continent's green layer, or
 * TAN_TOP_HEIGHT over its smaller tan highland inset (if it has one). The
 * one place that actually reasons about "how tall is the ground here" -
 * everything that needs to stand on the terrain (trees; see scatterTrees)
 * goes through this, so it can never disagree with what the mesh itself
 * renders.
 */
export const heightAt = (
  planetRadius: number,
  center: Vector3,
  lon: number,
  lat: number,
): number => {
  for (const c of CONTINENTS) {
    const { east, north } = tangentOffsetOf(planetRadius, center, c, lon, lat);
    const dist = Math.hypot(east, north);
    const bearing = Math.atan2(east, north);
    const radius = outlineRadiusAt(c, bearing);
    if (dist >= radius) continue;
    if (c.highland && dist < radius * c.highland.scale) return TAN_TOP_HEIGHT;
    return GREEN_TOP_HEIGHT;
  }
  return 0;
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
 * heightAt so every tree lands on a continent, exactly at that point's own
 * terrain height - never floating over open ocean or hovering above/
 * clipping into the actual extruded ground. Pure function of its inputs
 * (no live randomness), so it's stable across re-renders and safe to
 * memoize on them.
 */
export const scatterTrees = (
  count: number,
  planetRadius: number,
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
    const height = heightAt(planetRadius, center, lon, lat);
    if (height <= 0) continue;

    const position = pointOnSphere(planetRadius + height, lat, lon, center);
    const normal = position.clone().sub(center).normalize();
    trees.push({ position, normal, seed: seededRandom(a * 7.13) });
  }

  return trees;
};
