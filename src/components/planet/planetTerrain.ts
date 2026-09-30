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

export type ContinentVariant = "forest" | "desert" | "snow";

export interface ContinentDef {
  lon: number; // radians, centroid - planetSurface's pointOnSphere convention
  lat: number;
  /** Average outline radius, in world units (arc length at the centroid). */
  baseRadius: number;
  /** Summed sine wobble on top of baseRadius - what turns a circle into an organic, wavy-coastline landmass silhouette. */
  harmonics: OutlineHarmonic[];
  /** "forest" (green, the default - trees grow here), "desert" (solid tan/sand, no green layer, no trees), or "snow" (forested green slopes with a mandatory white snow-capped peak) - see landmass.tsx. */
  variant?: ContinentVariant;
  /** A smaller inset cap stacked on the base layer - tan "highland" on a forest continent (optional), or the mandatory white peak on a "snow" one. */
  highland?: { scale: number };
}

const deg = (d: number): number => (d * Math.PI) / 180;

/**
 * Three hand-authored continents (forest, desert, snow-mountain), spread at
 * roughly 120-degree longitude separation. No small islands: at this size
 * there's no room left for them without either overlapping a continent's
 * own outline or starving the trail of a safe latitude somewhere around
 * the loop. The ship's own physical footprint (not the much larger
 * board/activation-zone one - see calculatedBoardPositionsAndRotations.ts's
 * CORRIDOR_HALF_WIDTH, which deliberately excludes that) is what the single
 * continuous trail has to keep clear of every landmass, and that's the real
 * ceiling on how much land this planet can hold at once. These baseRadius
 * values (27.5/26.5/25.5) are close to that ceiling - found empirically by
 * growing them against calculatedBoardPositionsAndRotations.test.ts's
 * "never runs through a continent/island" test (the trail's *actual*
 * generated shape, not just these positions in isolation) and this file's
 * own "no two continents/islands overlap" test: sizes a couple units
 * larger start overlapping each other outright, and sizes just below that
 * leave less than a unit of clearance, too tight a margin to keep. Total
 * surface coverage lands around 33% of the sphere (spherical-cap estimate)
 * - roughly the most three continents this shape can cover while a single
 * trail still safely threads around all of them.
 */
export const CONTINENTS: ContinentDef[] = [
  // Forest continent, with its own (optional) tan highland.
  {
    lon: deg(10),
    lat: deg(8),
    baseRadius: 27.5,
    harmonics: [
      { amplitude: 0.12, freq: 2, phase: 0.4 },
      { amplitude: 0.07, freq: 3, phase: 2.1 },
      { amplitude: 0.04, freq: 5, phase: 1.0 },
    ],
    highland: { scale: 0.35 },
  },
  // Desert continent - solid tan/sand, no trees.
  {
    lon: deg(130),
    lat: deg(-7),
    baseRadius: 26.5,
    harmonics: [
      { amplitude: 0.13, freq: 2, phase: 1.2 },
      { amplitude: 0.07, freq: 4, phase: 0.3 },
    ],
    variant: "desert",
  },
  // Snow-mountain continent - forested green slopes with a mandatory
  // white peak cap.
  {
    lon: deg(250),
    lat: deg(6),
    baseRadius: 25.5,
    harmonics: [
      { amplitude: 0.12, freq: 2, phase: 0.1 },
      { amplitude: 0.07, freq: 4, phase: 1.8 },
    ],
    variant: "snow",
    highland: { scale: 0.28 },
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

/**
 * A point on a continent's actual rendered coastline (scale=1) or, with a
 * smaller `scale`, its inset highland/desert cap - the exact same gnomonic
 * placement landmass.tsx's wrapGeometryOntoSphere uses for the real 3D
 * mesh (minus height, which doesn't matter for a flat outline), factored
 * out here so anything that wants to draw a landmass's *true* footprint -
 * the minimap, chiefly - reads the same shape the mesh itself renders
 * instead of a separate approximation of it.
 */
export const continentOutlinePoint = (
  c: ContinentDef,
  planetRadius: number,
  center: Vector3,
  bearing: number,
  scale = 1,
): Vector3 => {
  const centroidPos = pointOnSphere(planetRadius, c.lat, c.lon, center);
  const normal = surfaceNormal(centroidPos, center);
  const { east, north } = eastNorthAt(normal);
  const radius = outlineRadiusAt(c, bearing) * scale;
  return centroidPos
    .clone()
    .addScaledVector(east, radius * Math.sin(bearing))
    .addScaledVector(north, radius * Math.cos(bearing))
    .sub(center)
    .normalize()
    .multiplyScalar(planetRadius)
    .add(center);
};

// Extruded terrain heights (world units, above the ocean shell) and how far
// each layer's rim embeds into the one below it, hiding the seam - shared
// between the actual mesh builder (landmass.tsx) and heightAt below so a
// tree placed via heightAt always lands exactly on the surface the mesh
// itself renders, never floating above or clipping into it.
export const GREEN_HEIGHT = 1.5;
export const TAN_HEIGHT = 0.9;
export const DESERT_HEIGHT = 1.3;
// Taller than a forest continent's optional tan highland - a mountain
// peak, not just a raised plateau.
export const SNOW_HEIGHT = 2.2;
export const TERRAIN_EMBED = 0.1;
/** Where a highland/peak layer's own local z=0 should land, in the base layer's height space - see landmass.tsx. */
export const TAN_BASE_Z_OFFSET = GREEN_HEIGHT - TERRAIN_EMBED;
const GREEN_TOP_HEIGHT = GREEN_HEIGHT - TERRAIN_EMBED;
const TAN_TOP_HEIGHT = GREEN_TOP_HEIGHT - TERRAIN_EMBED + TAN_HEIGHT;
const SNOW_TOP_HEIGHT = GREEN_TOP_HEIGHT - TERRAIN_EMBED + SNOW_HEIGHT;
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
  variants: ContinentVariant[] = ["forest", "desert", "snow"],
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
      return c.variant === "snow" ? SNOW_TOP_HEIGHT : TAN_TOP_HEIGHT;
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
      "snow",
    ]);
    if (height <= 0) continue;

    const position = pointOnSphere(planetRadius + height, lat, lon, center);
    const normal = position.clone().sub(center).normalize();
    trees.push({ position, normal, seed: seededRandom(a * 7.13) });
  }

  return trees;
};

export interface ScatteredAnimal {
  position: Vector3;
  normal: Vector3;
  heading: number;
  seed: number;
}

// Same idea as TREE_EDGE_MARGIN - keeps animals off the sloped coastline
// bevel too.
const ANIMAL_EDGE_MARGIN = 0.6;

/**
 * Deterministic animal scatter - same rejection-sampling approach as
 * scatterTrees, but restricted to plain "forest" continents (not the snow
 * one's forested slopes, and never desert), matching a grazing herd rather
 * than trees, which grow anywhere green. A different seed offset
 * (multiplied attempt index) keeps it from landing on the exact same spots
 * scatterTrees already placed trees on.
 */
export const scatterAnimals = (
  count: number,
  planetRadius: number,
  center: Vector3,
): ScatteredAnimal[] => {
  const animals: ScatteredAnimal[] = [];
  let attempt = 0;
  const maxAttempts = count * 60;

  while (animals.length < count && attempt < maxAttempts) {
    const a = attempt++;
    const lon = (seededRandom(a * 2.3 + 101) - 0.5) * Math.PI * 2;
    const lat = (seededRandom(a * 2.3 + 202) - 0.5) * Math.PI * 0.9;
    const height = heightAt(
      planetRadius,
      center,
      lon,
      lat,
      ANIMAL_EDGE_MARGIN,
      ["forest"],
    );
    if (height <= 0) continue;

    const position = pointOnSphere(planetRadius + height, lat, lon, center);
    const normal = position.clone().sub(center).normalize();
    const heading = seededRandom(a * 5.77 + 303) * Math.PI * 2;
    animals.push({ position, normal, heading, seed: seededRandom(a * 9.41) });
  }

  return animals;
};
