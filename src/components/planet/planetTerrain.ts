import { Vector3 } from "three";
import {
  eastNorthAt,
  pointOnSphere,
  surfaceNormal,
} from "../../utils/planetSurface";
import {
  BOARD_SIDE_OFFSET,
  pathFrameAt,
} from "../timeline/calculatedBoardPositionsAndRotations";

export interface OutlineHarmonic {
  amplitude: number;
  freq: number;
  phase: number;
}

export type ContinentVariant = "forest" | "desert";

export interface ContinentDef {
  lon: number; // radians, centroid - planetSurface's pointOnSphere convention
  lat: number;
  /** Average outline radius, in world units (arc length at the centroid). */
  baseRadius: number;
  /** Summed sine wobble on top of baseRadius - what turns a circle into an organic, wavy-coastline landmass silhouette. */
  harmonics: OutlineHarmonic[];
  /** "forest" (green, the default - trees grow here) or "desert" (solid tan/sand, no green layer, no trees - see landmass.tsx). */
  variant?: ContinentVariant;
  /** A smaller inset "highland" cap (tan, stacked on the green layer) - forest continents only. */
  highland?: { scale: number };
}

const deg = (d: number): number => (d * Math.PI) / 180;

// How much room the ship's cruise trail actually needs, in world units:
// half of the board's own footprint (boardParams.json's outerX) plus its
// sideways offset from the centerline, the activation zone's half-width,
// and a small turning-clearance buffer - i.e. everything that can ever sit
// near the trail.
const BOARD_HALF_WIDTH = 3.35;
const ZONE_HALF_WIDTH = 4;
const CORRIDOR_SAFETY_MARGIN = 3;
export const CORRIDOR_HALF_WIDTH =
  BOARD_SIDE_OFFSET +
  BOARD_HALF_WIDTH +
  ZONE_HALF_WIDTH +
  CORRIDOR_SAFETY_MARGIN;

// How finely the trail is sampled when checking a candidate landmass's
// clearance from it - dense enough that the wiggle (5 cycles around the
// planet) can't hide a close approach between samples.
const PATH_DISTANCE_SAMPLES = 720;

/**
 * The closest the ship's trail ever gets to a given point, in world units -
 * a real per-point check against the actual (wiggly) path, rather than a
 * blanket "stay above this latitude" rule. That's what lets landmasses sit
 * at a wide range of latitudes - as close to the route as the trail's own
 * wiggle happens to allow at that specific spot - instead of being pushed
 * into two tidy polar caps regardless of longitude.
 */
export const minDistanceToPath = (
  planetRadius: number,
  center: Vector3,
  lon: number,
  lat: number,
): number => {
  const point = pointOnSphere(planetRadius, lat, lon, center);
  let min = Infinity;
  for (let i = 0; i < PATH_DISTANCE_SAMPLES; i++) {
    const sampleLon = (i / PATH_DISTANCE_SAMPLES) * Math.PI * 2;
    const samplePos = pathFrameAt(planetRadius, sampleLon, center).position;
    const d = point.distanceTo(samplePos);
    if (d < min) min = d;
  }
  return min;
};

/**
 * Hand-authored continents and islands. Positions were found by
 * rejection-sampling the full lat/lon space for spots whose closest
 * approach to the trail (see minDistanceToPath) clears CORRIDOR_HALF_WIDTH
 * and that don't overlap any other landmass (see planetTerrain.test.ts's
 * "no two continents/islands overlap" and "every landmass clears the
 * trail/board/zone corridor") - not hand-picked by eye, since near the
 * poles circles of longitude converge and a "safe-looking" gap can still
 * overlap. The result scatters landmasses across a wide range of
 * latitudes rather than clustering at the extreme poles, since the trail's
 * own wiggle (not a fixed latitude line) is what each one actually has to
 * clear.
 */
export const CONTINENTS: ContinentDef[] = [
  {
    lon: deg(335.9),
    lat: deg(-71.6),
    baseRadius: 7.5,
    harmonics: [
      { amplitude: 0.15, freq: 2, phase: 0.4 },
      { amplitude: 0.1, freq: 3, phase: 2.1 },
      { amplitude: 0.05, freq: 5, phase: 1.0 },
    ],
    highland: { scale: 0.5 },
  },
  {
    lon: deg(274.6),
    lat: deg(80.6),
    baseRadius: 6,
    harmonics: [
      { amplitude: 0.18, freq: 2, phase: 1.2 },
      { amplitude: 0.1, freq: 4, phase: 0.3 },
    ],
  },
  {
    lon: deg(75.3),
    lat: deg(73.8),
    baseRadius: 5.5,
    harmonics: [
      { amplitude: 0.16, freq: 3, phase: 2.6 },
      { amplitude: 0.1, freq: 5, phase: 0.7 },
    ],
  },
  {
    lon: deg(197.9),
    lat: deg(-71.9),
    baseRadius: 6,
    harmonics: [
      { amplitude: 0.17, freq: 2, phase: 0.1 },
      { amplitude: 0.1, freq: 4, phase: 1.8 },
    ],
  },
  {
    lon: deg(142.5),
    lat: deg(59.3),
    baseRadius: 5.5,
    harmonics: [
      { amplitude: 0.16, freq: 2, phase: 2.0 },
      { amplitude: 0.1, freq: 3, phase: 0.9 },
    ],
  },
  {
    lon: deg(347.0),
    lat: deg(61.4),
    baseRadius: 5,
    harmonics: [
      { amplitude: 0.15, freq: 3, phase: 1.4 },
      { amplitude: 0.1, freq: 4, phase: 2.4 },
    ],
  },
  {
    lon: deg(103.6),
    lat: deg(-64.3),
    baseRadius: 5.5,
    harmonics: [
      { amplitude: 0.15, freq: 2, phase: 0.8 },
      { amplitude: 0.11, freq: 4, phase: 2.9 },
    ],
  },
  // Desert continents - solid tan/sand, no green layer, no trees (see
  // landmass.tsx and scatterTrees below).
  {
    lon: deg(194.6),
    lat: deg(54.1),
    baseRadius: 4.5,
    harmonics: [
      { amplitude: 0.17, freq: 2, phase: 0.6 },
      { amplitude: 0.1, freq: 4, phase: 2.0 },
    ],
    variant: "desert",
  },
  {
    lon: deg(268.7),
    lat: deg(-62.8),
    baseRadius: 4,
    harmonics: [
      { amplitude: 0.16, freq: 3, phase: 1.7 },
      { amplitude: 0.1, freq: 5, phase: 0.5 },
    ],
    variant: "desert",
  },
  // Smaller islands, filling the gaps between the continents above.
  {
    lon: deg(286.9),
    lat: deg(54.7),
    baseRadius: 3,
    harmonics: [
      { amplitude: 0.2, freq: 2, phase: 1.6 },
      { amplitude: 0.12, freq: 4, phase: 0.6 },
    ],
  },
  {
    lon: deg(42.0),
    lat: deg(-55.4),
    baseRadius: 3.5,
    harmonics: [
      { amplitude: 0.18, freq: 3, phase: 0.2 },
      { amplitude: 0.11, freq: 5, phase: 1.9 },
    ],
  },
  {
    lon: deg(254.2),
    lat: deg(52.0),
    baseRadius: 2.5,
    harmonics: [
      { amplitude: 0.2, freq: 2, phase: 2.4 },
      { amplitude: 0.13, freq: 4, phase: 1.1 },
    ],
  },
  {
    lon: deg(228.3),
    lat: deg(-56.1),
    baseRadius: 3,
    harmonics: [
      { amplitude: 0.19, freq: 3, phase: 1.3 },
      { amplitude: 0.12, freq: 5, phase: 0.4 },
    ],
  },
  {
    lon: deg(166.6),
    lat: deg(-46.8),
    baseRadius: 3,
    harmonics: [
      { amplitude: 0.19, freq: 2, phase: 0.5 },
      { amplitude: 0.12, freq: 4, phase: 2.2 },
    ],
  },
  {
    lon: deg(41.2),
    lat: deg(54.7),
    baseRadius: 3.5,
    harmonics: [
      { amplitude: 0.18, freq: 3, phase: 1.8 },
      { amplitude: 0.11, freq: 5, phase: 0.3 },
    ],
  },
  {
    lon: deg(290.7),
    lat: deg(-51.5),
    baseRadius: 2.5,
    harmonics: [
      { amplitude: 0.2, freq: 2, phase: 0.9 },
      { amplitude: 0.13, freq: 4, phase: 2.7 },
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
export const DESERT_HEIGHT = 1.3;
export const TERRAIN_EMBED = 0.1;
/** Where a highland layer's own local z=0 should land, in the green layer's height space - see landmass.tsx. */
export const TAN_BASE_Z_OFFSET = GREEN_HEIGHT - TERRAIN_EMBED;
const GREEN_TOP_HEIGHT = GREEN_HEIGHT - TERRAIN_EMBED;
const TAN_TOP_HEIGHT = GREEN_TOP_HEIGHT - TERRAIN_EMBED + TAN_HEIGHT;
const DESERT_TOP_HEIGHT = DESERT_HEIGHT - TERRAIN_EMBED;

/**
 * This point's tangent-plane offset (world units, east/north) from a
 * continent's own centroid, via the exact inverse of the gnomonic
 * projection landmass.tsx's wrapGeometryOntoSphere uses to bend a flat
 * extruded shape onto the sphere - not an approximation, so a point this
 * says is "inside the outline" is *always* a point the actual rendered
 * mesh covers too, and vice versa. Returns null for a point more than 90
 * degrees away (behind the horizon from this continent - definitely not
 * on it), where the projection has no finite answer.
 */
const continentTangentOffset = (
  planetRadius: number,
  center: Vector3,
  c: ContinentDef,
  lon: number,
  lat: number,
): { east: number; north: number } | null => {
  const centroidPos = pointOnSphere(planetRadius, c.lat, c.lon, center);
  const normal = surfaceNormal(centroidPos, center);
  const { east, north } = eastNorthAt(normal);

  const direction = pointOnSphere(planetRadius, lat, lon, center)
    .sub(center)
    .normalize();
  const denom = direction.dot(normal);
  if (denom <= 1e-6) return null;

  const t = planetRadius / denom;
  const gnomonic = direction
    .multiplyScalar(t)
    .addScaledVector(normal, -planetRadius);
  return { east: gnomonic.dot(east), north: gnomonic.dot(north) };
};

/**
 * Terrain height (world units above the ocean shell) at a given lon/lat -
 * 0 over open ocean or over a variant not in `variants`, otherwise the
 * flat interior height of whatever's there (green, its tan highland inset,
 * or a desert continent). `margin` shrinks every outline inward by that
 * many world units before testing - scatterTrees uses this to stay off the
 * sloped bevel ring right at the coastline (see landmass.tsx's bevelSize),
 * where the true surface height ramps down toward the ocean rather than
 * sitting at the flat interior height this function would otherwise
 * report.
 *
 * The one place that actually reasons about "how tall is the ground here" -
 * everything that needs to stand on the terrain goes through this, so it
 * can never disagree with what the mesh itself renders.
 */
export const heightAt = (
  planetRadius: number,
  center: Vector3,
  lon: number,
  lat: number,
  margin = 0,
  variants: ContinentVariant[] = ["forest", "desert"],
): number => {
  for (const c of CONTINENTS) {
    if (!variants.includes(c.variant ?? "forest")) continue;
    const offset = continentTangentOffset(planetRadius, center, c, lon, lat);
    if (!offset) continue;
    const dist = Math.hypot(offset.east, offset.north);
    const bearing = Math.atan2(offset.east, offset.north);
    const radius = outlineRadiusAt(c, bearing) - margin;
    if (dist >= radius) continue;
    if (c.variant === "desert") return DESERT_TOP_HEIGHT;
    if (c.highland && dist < radius * c.highland.scale - margin) {
      return TAN_TOP_HEIGHT;
    }
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

// Keeps trees off the sloped bevel ring right at a continent's coastline -
// see heightAt's `margin` doc above. Comfortably bigger than either
// layer's actual bevelSize (landmass.tsx), so a tree only ever lands on
// flat, full-height ground.
const TREE_EDGE_MARGIN = 0.6;

/**
 * Deterministic tree scatter: rejection-samples lon/lat points against
 * heightAt (forest continents only - deserts stay bare) so every tree
 * lands on a continent, exactly at that point's own terrain height - never
 * floating over open ocean or hovering above/clipping into the actual
 * extruded ground. Pure function of its inputs (no live randomness), so
 * it's stable across re-renders and safe to memoize on them.
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
    const height = heightAt(planetRadius, center, lon, lat, TREE_EDGE_MARGIN, [
      "forest",
    ]);
    if (height <= 0) continue;

    const position = pointOnSphere(planetRadius + height, lat, lon, center);
    const normal = position.clone().sub(center).normalize();
    trees.push({ position, normal, seed: seededRandom(a * 7.13) });
  }

  return trees;
};
