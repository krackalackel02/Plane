import { Vector3 } from "three";
import {
  angleBetween,
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
  /** "forest" (green, the default - the only biome trees and animals live on), "desert" (solid tan/sand), or "snow" (bare white rock under a mandatory white peak - no green anywhere on it) - see landmass.tsx. */
  variant?: ContinentVariant;
  /** A smaller inset cap stacked on the base layer - tan "highland" on a forest continent (optional), or the mandatory white peak on a "snow" one. */
  highland?: { scale: number };
  /**
   * Narrow, deep inlets cut into the coastline - fjords. Sine harmonics can
   * only make broad, gentle bays; an inlet is a localised notch, so each is a
   * Gaussian dip in the outline radius centred on its own bearing.
   */
  inlets?: Inlet[];
}

export interface Inlet {
  /** Bearing around the centroid, radians (0 = north, clockwise). */
  bearing: number;
  /** How far in it cuts, as a fraction of baseRadius. */
  depth: number;
  /** Half-width of the notch, radians of bearing. */
  width: number;
}

/** Signed difference a - b of two bearings, wrapped into (-PI, PI]. */
const bearingDelta = (a: number, b: number): number => {
  const d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) return d - Math.PI * 2;
  if (d <= -Math.PI) return d + Math.PI * 2;
  return d;
};

/** The outline's fractional wobble at a bearing, and its rate of change with bearing. */
const outlineShape = (
  c: ContinentDef,
  bearing: number,
): { wobble: number; rate: number } => {
  let wobble = 0;
  let rate = 0;
  for (const h of c.harmonics) {
    wobble += h.amplitude * Math.sin(h.freq * bearing + h.phase);
    rate += h.amplitude * h.freq * Math.cos(h.freq * bearing + h.phase);
  }
  for (const inlet of c.inlets ?? []) {
    const d = bearingDelta(bearing, inlet.bearing);
    const notch = inlet.depth * Math.exp(-((d / inlet.width) ** 2));
    wobble -= notch;
    rate += (notch * 2 * d) / inlet.width ** 2;
  }
  return { wobble, rate };
};

const deg = (d: number): number => (d * Math.PI) / 180;

/**
 * Three big hand-authored continents - one per biome (forest, desert,
 * snow-mountain) - staggered north/south/north at 120-degree longitude
 * spacing. Together they cover close to half the sphere's surface area
 * (~49%, see surfaceCoverageFraction), which is the point: the ocean is
 * meant to read as the gap between real continents, not as the whole
 * planet with a few islands dropped in it.
 *
 * The layout isn't eyeballed. What limits it is that a *single continuous*
 * trail (a latitude per longitude, all the way around - see
 * calculatedBoardPositionsAndRotations.ts) has to thread between all three
 * while keeping CORRIDOR_HALF_WIDTH clear of every coastline, so the three
 * have to leave an unbroken navigable channel around the loop. The
 * north/south/north stagger is what buys that channel: the trail weaves
 * about +-35 degrees of latitude through the gaps rather than running a
 * band around the equator (which is what made the planet look split into
 * two halves when the continents all sat near it). These positions and
 * radii came out of a grid search over (latitude stagger, radius,
 * coastline wobble) maximising coverage subject to the trail still
 * existing and staying smooth, and the outcome is pinned by two tests:
 * this file's "no two continents overlap" (they clear each other by ~7
 * world units) and calculatedBoardPositionsAndRotations.test.ts's "never
 * runs through a continent", which checks the trail's *actual* generated
 * shape rather than these positions in isolation.
 *
 * Coastline wobble is deliberately gentler than it was on the old small
 * continents (~9% rather than ~13%): on a landmass this large the same
 * fractional wobble is several world units of coastline swing, which is
 * enough to eat the whole inter-continent gap.
 */
export const CONTINENTS: ContinentDef[] = [
  // Forest continent, with a small tan highland plateau.
  {
    lon: deg(0),
    lat: deg(22),
    baseRadius: 33.1,
    harmonics: [
      { amplitude: 0.2, freq: 1, phase: 0.6 },
      { amplitude: 0.15, freq: 2, phase: 0.4 },
      { amplitude: 0.09, freq: 3, phase: 2.1 },
      { amplitude: 0.05, freq: 5, phase: 1.0 },
      { amplitude: 0.03, freq: 8, phase: 0.2 },
    ],
    highland: { scale: 0.22 },
  },
  // Desert continent - sand, rocks and dunes, no trees.
  {
    lon: deg(120),
    lat: deg(-28),
    baseRadius: 34.5,
    harmonics: [
      { amplitude: 0.18, freq: 1, phase: 2.4 },
      { amplitude: 0.16, freq: 2, phase: 1.2 },
      { amplitude: 0.08, freq: 3, phase: 0.3 },
      { amplitude: 0.05, freq: 5, phase: 2.6 },
      { amplitude: 0.03, freq: 7, phase: 1.5 },
    ],
    variant: "desert",
  },
  // Snow continent - an ice-shelf base carrying two mountain chains, its
  // coast cut by fjords. Smaller than the other two: at full size it
  // dominated every view of this side of the planet.
  {
    lon: deg(240),
    lat: deg(26),
    baseRadius: 28,
    harmonics: [
      { amplitude: 0.19, freq: 1, phase: 4.1 },
      { amplitude: 0.14, freq: 2, phase: 0.1 },
      { amplitude: 0.09, freq: 4, phase: 1.8 },
      { amplitude: 0.05, freq: 6, phase: 0.9 },
      { amplitude: 0.03, freq: 9, phase: 2.2 },
    ],
    inlets: [
      { bearing: 0.4, depth: 0.26, width: 0.07 },
      { bearing: 1.7, depth: 0.2, width: 0.09 },
      { bearing: 2.9, depth: 0.3, width: 0.06 },
      { bearing: 4.1, depth: 0.18, width: 0.08 },
      { bearing: 5.3, depth: 0.24, width: 0.07 },
    ],
    variant: "snow",
  },
  // Small islands in the open ocean between the continents.
  //
  // Placed by proposing a candidate, re-running the whole layout with it
  // included, and keeping it only if every project's stop still had its
  // MIN_BOARD_WATER of open water and the composed trail still cleared the
  // corridor. Only three of over a hundred trial positions survived that:
  // with land at a third of the sphere and eight open-water pockets reserved
  // for the stops, there is genuinely not much ocean left to drop an island
  // into without taking a stop's water or pinching the trail.
  {
    lon: deg(325.6),
    lat: deg(-38.4),
    baseRadius: 5.2,
    harmonics: [
      { amplitude: 0.16, freq: 2, phase: 0.3 },
      { amplitude: 0.1, freq: 3, phase: 1.1 },
      { amplitude: 0.05, freq: 5, phase: 2.0 },
    ],
  },
  {
    lon: deg(149),
    lat: deg(35.8),
    baseRadius: 4.4,
    harmonics: [
      { amplitude: 0.16, freq: 2, phase: 1.3 },
      { amplitude: 0.1, freq: 3, phase: 1.8 },
      { amplitude: 0.05, freq: 5, phase: 3.0 },
    ],
  },
  {
    lon: deg(171.3),
    lat: deg(-17.7),
    baseRadius: 4.8,
    harmonics: [
      { amplitude: 0.16, freq: 2, phase: 2.3 },
      { amplitude: 0.1, freq: 3, phase: 2.5 },
      { amplitude: 0.05, freq: 5, phase: 4.0 },
    ],
  },
];

/** The wobbled outline radius (world units) at a given bearing (radians) around a continent's own centroid. */
export const outlineRadiusAt = (c: ContinentDef, bearing: number): number =>
  c.baseRadius * (1 + outlineShape(c, bearing).wobble);

/** Unit direction from the planet's center toward a lat/lon - center-independent, so nothing here needs one. */
const directionAt = (lat: number, lon: number): Vector3 =>
  pointOnSphere(1, lat, lon);

/**
 * How far a continent's coastline reaches from its own centroid, as an
 * angle at the planet's center. baseRadius/outlineRadiusAt are
 * tangent-plane distances (that's the space landmass.tsx extrudes the shape
 * in before bending it onto the sphere), and the gnomonic wrap puts a
 * vertex `r` out in the tangent plane at exactly atan(r / planetRadius) of
 * arc from the centroid - so this is the outline's true angular radius, not
 * an approximation of it.
 */
const angularOutlineRadius = (
  c: ContinentDef,
  planetRadius: number,
  bearing: number,
): number => Math.atan(outlineRadiusAt(c, bearing) / planetRadius);

/**
 * Great-circle clearance from a direction to the nearest coastline, in
 * world units of arc along the surface - negative when the direction is
 * over land.
 *
 * Everything that needs to know "how much open water is here" goes through
 * this. It matters that it measures *angles* consistently on both sides:
 * an earlier version compared a straight-line chord distance to a
 * continent's centroid against its tangent-plane outline radius, which are
 * two different measures of the same coastline. On the old small
 * continents they were within a few percent of each other and it went
 * unnoticed, but the discrepancy grows with angular size (a 34-degree
 * continent's tangent radius overstates its chord radius by ~17%), and on
 * continents this big it badly mis-stated clearance in both directions at
 * once - reserving far more room than the trail needed in open water, while
 * still letting the trail's own routing search run straight through a
 * coastline it thought it had cleared.
 */
export const surfaceClearanceOf = (
  planetRadius: number,
  direction: Vector3,
): number => {
  let min = Infinity;
  for (const c of CONTINENTS) {
    const centroidDirection = directionAt(c.lat, c.lon);
    const { east, north } = eastNorthAt(centroidDirection);
    const separation = angleBetween(centroidDirection, direction);
    const bearing = Math.atan2(direction.dot(east), direction.dot(north));
    const clearance =
      separation - angularOutlineRadius(c, planetRadius, bearing);
    if (clearance < min) min = clearance;
  }
  return min * planetRadius;
};

/**
 * surfaceClearanceOf together with its gradient: a unit-sphere tangent vector
 * giving the clearance gained per world unit moved in each direction.
 *
 * Analytic rather than finite-differenced. For the nearest landmass the
 * clearance is R * (sep - atan(r(bearing) / R)), so its gradient is the
 * direction directly away from that landmass's centroid, minus how fast the
 * coastline's own angular radius changes as the bearing around it turns.
 * That matters to anything steering by it - the trail's elastic band follows
 * this gradient every iteration, and a gradient sampled off a grid is only
 * piecewise-constant, which was enough to make the band jitter cell-to-cell
 * and fold on itself in narrow channels.
 */
export const surfaceClearanceWithGradient = (
  planetRadius: number,
  direction: Vector3,
): { clearance: number; gradient: Vector3 } => {
  let clearance = Infinity;
  const gradient = new Vector3();
  for (const c of CONTINENTS) {
    const centroid = directionAt(c.lat, c.lon);
    const { east, north } = eastNorthAt(centroid);
    const cosSep = Math.max(-1, Math.min(1, centroid.dot(direction)));
    const separation = Math.acos(cosSep);
    const alongEast = direction.dot(east);
    const alongNorth = direction.dot(north);
    const bearing = Math.atan2(alongEast, alongNorth);

    // Same shape function outlineRadiusAt uses, inlets included, so the
    // gradient can never disagree with the clearance it differentiates.
    const { wobble, rate: wobbleRate } = outlineShape(c, bearing);
    const radius = c.baseRadius * (1 + wobble);
    const value =
      (separation - Math.atan(radius / planetRadius)) * planetRadius;
    if (value >= clearance) continue;
    clearance = value;

    // d(separation): straight away from the centroid.
    const away = direction
      .clone()
      .multiplyScalar(cosSep)
      .sub(centroid)
      .normalize();
    // d(bearing): perpendicular to that, scaled by how tightly bearings bunch
    // up near the centroid.
    const spread = alongEast * alongEast + alongNorth * alongNorth;
    const bearingGradient =
      spread < 1e-12
        ? new Vector3()
        : east
            .clone()
            .multiplyScalar(alongNorth)
            .addScaledVector(north, -alongEast)
            .multiplyScalar(1 / spread);
    bearingGradient.addScaledVector(direction, -bearingGradient.dot(direction));
    const thetaRate =
      (c.baseRadius * wobbleRate) /
      planetRadius /
      (1 + (radius / planetRadius) ** 2);
    gradient.copy(away).addScaledVector(bearingGradient, -thetaRate);
  }
  return { clearance, gradient };
};

/** surfaceClearanceOf at a lat/lon rather than a direction. */
export const surfaceClearanceAt = (
  planetRadius: number,
  lon: number,
  lat: number,
): number => surfaceClearanceOf(planetRadius, directionAt(lat, lon));

/**
 * Fraction of the planet's surface area covered by land. Integrates each
 * continent's own wobbled outline as a spherical cap per bearing, so it
 * accounts for the coastline wobble rather than treating every landmass as
 * a perfect circle. Exported chiefly so a test can pin the "roughly half
 * the planet is land" intent that drives the CONTINENTS layout above.
 */
export const surfaceCoverageFraction = (planetRadius: number): number => {
  const SAMPLES = 720;
  let total = 0;
  for (const c of CONTINENTS) {
    let sum = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const bearing = (i / SAMPLES) * Math.PI * 2;
      const theta = angularOutlineRadius(c, planetRadius, bearing);
      sum += (1 - Math.cos(theta)) / 2;
    }
    total += sum / SAMPLES;
  }
  return total;
};

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
// The snow continent's base layer is bare white rock, not green - taller
// than a forest continent's grass so the whole landmass reads as a raised,
// rugged massif rather than a plain with a hat on.
export const SNOW_BASE_HEIGHT = 1.9;
// Taller again than a forest continent's optional tan highland - a mountain
// peak, not just a raised plateau.
export const SNOW_HEIGHT = 2.6;
export const TERRAIN_EMBED = 0.1;

/**
 * The bevel landmass.tsx extrudes each layer with. It lives here, beside the
 * heights, because it is not merely cosmetic: a bevelled ExtrudeGeometry
 * spans z from -bevelThickness to depth + bevelThickness, so the flat top
 * surface a tree actually stands on is a bevel-thickness *higher* than the
 * nominal depth. Deriving the heights below without it left every tree and
 * animal sunk 0.35 world units into the ground.
 */
export const bevelThicknessFor = (depth: number): number =>
  Math.min(0.35, depth * 0.4);
export const bevelSizeFor = (depth: number): number =>
  Math.min(0.45, depth * 0.4);

const baseDepthFor = (variant: ContinentVariant): number => {
  if (variant === "desert") return DESERT_HEIGHT;
  return variant === "snow" ? SNOW_BASE_HEIGHT : GREEN_HEIGHT;
};
const capDepthFor = (variant: ContinentVariant): number =>
  variant === "snow" ? SNOW_HEIGHT : TAN_HEIGHT;

/** Height above the ocean shell of a layer's flat top surface. */
const topSurfaceOf = (depth: number, zOffset = 0): number =>
  zOffset + depth + bevelThicknessFor(depth) - TERRAIN_EMBED;

/**
 * Where a cap layer's own local z=0 should land, in its base layer's height
 * space, so the cap's underside sits exactly TERRAIN_EMBED into the base's
 * top surface - flush, with the join hidden and no floating gap. Follows the
 * variant because the snow continent's cap sits on a taller base than a
 * forest continent's tan highland does, and because the two layers' bevels
 * differ (see landmass.tsx).
 */
export const capBaseZOffset = (variant: ContinentVariant): number =>
  baseDepthFor(variant) +
  bevelThicknessFor(baseDepthFor(variant)) +
  bevelThicknessFor(capDepthFor(variant)) -
  TERRAIN_EMBED;

const GREEN_TOP_HEIGHT = topSurfaceOf(GREEN_HEIGHT);
const SNOW_BASE_TOP_HEIGHT = topSurfaceOf(SNOW_BASE_HEIGHT);
const DESERT_TOP_HEIGHT = topSurfaceOf(DESERT_HEIGHT);
const TAN_TOP_HEIGHT = topSurfaceOf(TAN_HEIGHT, capBaseZOffset("forest"));
const SNOW_TOP_HEIGHT = topSurfaceOf(SNOW_HEIGHT, capBaseZOffset("snow"));

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
    const outline = outlineRadiusAt(c, bearing);
    if (dist >= outline - margin) continue;
    if (c.variant === "desert") return DESERT_TOP_HEIGHT;

    const isSnow = c.variant === "snow";
    if (c.highland) {
      const cap = outline * c.highland.scale;
      if (dist < cap - margin) return isSnow ? SNOW_TOP_HEIGHT : TAN_TOP_HEIGHT;
      // Inside the cap's own bevelled rim: which layer a prop would stand on
      // is genuinely ambiguous here, so a margin-respecting caller is told
      // there is nowhere to stand. Without this the margin shrank only the
      // cap's *inner* test, so a tree just inside the real cap edge was placed
      // at the green layer's height and stood sunk into the plateau.
      if (dist < cap + margin) return 0;
    }
    return isSnow ? SNOW_BASE_TOP_HEIGHT : GREEN_TOP_HEIGHT;
  }
  return 0;
};

export interface ScatteredFeature {
  position: Vector3;
  normal: Vector3;
  /** Deterministic 0..1 draw, stable across re-renders for the same index. */
  seed: number;
}

/** @deprecated name kept for the tree call sites; identical to ScatteredFeature. */
export type ScatteredTree = ScatteredFeature;

const seededRandom = (n: number): number => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// Keeps scattered props off the sloped bevel ring right at a continent's
// coastline - see heightAt's `margin` doc above. Comfortably bigger than any
// layer's actual bevelSize (landmass.tsx), so a prop only ever lands on flat,
// full-height ground.
const FEATURE_EDGE_MARGIN = 0.6;

/**
 * Deterministic rejection scatter of props onto whichever biomes `variants`
 * names: samples lon/lat, keeps the points that land on qualifying land, and
 * places each one at exactly that point's own terrain height - never floating
 * over open ocean, never hovering above or clipping into the extruded ground.
 *
 * Pure function of its inputs (no live randomness), so it's stable across
 * re-renders and safe to memoize on them. `seedOffset` separates one
 * population from another, so trees, animals, bushes, rocks and peaks don't
 * all pile onto the same handful of spots.
 */
export const scatterFeatures = (
  count: number,
  planetRadius: number,
  center: Vector3,
  variants: ContinentVariant[],
  seedOffset: number,
  edgeMargin: number = FEATURE_EDGE_MARGIN,
): ScatteredFeature[] => {
  const features: ScatteredFeature[] = [];
  let attempt = 0;
  // Bounded attempts, not a while(features.length<count), so a pathological
  // CONTINENTS edit (e.g. all radius 0) can't spin this forever.
  const maxAttempts = count * 80;

  while (features.length < count && attempt < maxAttempts) {
    const a = attempt++;
    const lon = (seededRandom(a * 2.1 + seedOffset) - 0.5) * Math.PI * 2;
    const lat =
      (seededRandom(a * 2.1 + seedOffset + 0.5) - 0.5) * Math.PI * 0.9;
    const height = heightAt(
      planetRadius,
      center,
      lon,
      lat,
      edgeMargin,
      variants,
    );
    if (height <= 0) continue;

    const position = pointOnSphere(planetRadius + height, lat, lon, center);
    features.push({
      position,
      normal: position.clone().sub(center).normalize(),
      seed: seededRandom(a * 7.13 + seedOffset),
    });
  }

  return features;
};

/**
 * Trees - the green forest continent only (the desert is bare sand and the
 * snow continent bare rock).
 */
export const scatterTrees = (
  count: number,
  planetRadius: number,
  center: Vector3,
): ScatteredFeature[] =>
  scatterFeatures(count, planetRadius, center, ["forest"], 1);

/** Low shrubs and bushes filling in between the trees on the forest continent. */
export const scatterBushes = (
  count: number,
  planetRadius: number,
  center: Vector3,
): ScatteredFeature[] =>
  scatterFeatures(count, planetRadius, center, ["forest"], 413);

/** Rocks, dunes and mesas breaking up the desert's otherwise flat sand. */
export const scatterDesertFeatures = (
  count: number,
  planetRadius: number,
  center: Vector3,
): ScatteredFeature[] =>
  scatterFeatures(count, planetRadius, center, ["desert"], 787);

export interface RidgeSegment {
  /** Ground point the segment stands on, on the snow continent's surface. */
  position: Vector3;
  normal: Vector3;
  seed: number;
  /** Unit tangent: the direction its chain runs at this point. */
  along: Vector3;
  /** Summit height above the ground it stands on, world units. */
  height: number;
  /** Footprint half-width across the chain, world units. */
  width: number;
  /** Which of the two chains it belongs to (0 or 1). */
  chain: number;
}

// Half-width of the open valley kept between the two chains, world units -
// the pass through the range.
const SNOW_VALLEY_HALF_WIDTH = 9;
// How far either side of that valley each chain's crest line runs.
const CHAIN_OFFSET = 6;
// Along-chain spacing of segments, world units. Closer than a segment is
// long, so neighbours interpenetrate and the chain renders as one continuous
// crest rather than a row of separate peaks.
const RIDGE_SPACING = 2.4;
// Central summits, and the foothills the chain tapers to at the coast.
const RIDGE_PEAK_HEIGHT = 9;
const RIDGE_FOOTHILL_HEIGHT = 1.3;
// Gentle sideways wander of each crest line, so the chains aren't ruled.
const CHAIN_SINUOSITY = 2.6;

/**
 * The snow continent's mountain range: two continuous chains running along
 * the continent's long axis, one either side of an open central valley.
 *
 * Deliberately not scattered. Scattering seed points and walking a random
 * bearing from each - an earlier version - put most peaks round the coast and
 * never lined them up into crests; it read as a ring of spikes. Here each
 * chain is a crest line laid along the long axis (the bearing where the
 * continent is widest end to end), every segment is oriented along it, and
 * height comes from position rather than chance: tallest at the middle of a
 * chain, tapering to foothills toward both ends and toward the coast.
 */
export const ridgeChains = (
  planetRadius: number,
  center: Vector3,
): RidgeSegment[] => {
  const snow = CONTINENTS.find((c) => c.variant === "snow");
  if (!snow) return [];

  const centroid = directionAt(snow.lat, snow.lon);
  const { east, north } = eastNorthAt(centroid);

  // The long axis: the bearing whose full diameter through the centroid is
  // largest.
  let axisBearing = 0;
  let widest = 0;
  for (let i = 0; i < 180; i++) {
    const b = (i / 180) * Math.PI;
    const span = outlineRadiusAt(snow, b) + outlineRadiusAt(snow, b + Math.PI);
    if (span > widest) {
      widest = span;
      axisBearing = b;
    }
  }
  const axis = east
    .clone()
    .multiplyScalar(Math.sin(axisBearing))
    .addScaledVector(north, Math.cos(axisBearing));
  const across = east
    .clone()
    .multiplyScalar(Math.cos(axisBearing))
    .addScaledVector(north, -Math.sin(axisBearing));

  const forward = outlineRadiusAt(snow, axisBearing);
  const backward = outlineRadiusAt(snow, axisBearing + Math.PI);
  // A point at tangent-plane offset (x along the axis, y across it), placed
  // exactly the way the landmass mesh itself is wrapped onto the sphere.
  const surfaceDirection = (x: number, y: number): Vector3 =>
    centroid
      .clone()
      .multiplyScalar(planetRadius)
      .addScaledVector(axis, x)
      .addScaledVector(across, y)
      .normalize();

  const segments: RidgeSegment[] = [];
  [-1, 1].forEach((side, chain) => {
    const steps = Math.floor((forward + backward) / RIDGE_SPACING);
    const phase = chain * 2.1;
    for (let i = 0; i <= steps; i++) {
      const x = -backward + i * RIDGE_SPACING;
      const u = i / steps; // 0..1 along the chain
      const wander = CHAIN_SINUOSITY * Math.sin(u * Math.PI * 2.6 + phase);
      const y = side * (SNOW_VALLEY_HALF_WIDTH + CHAIN_OFFSET) + wander;

      const direction = surfaceDirection(x, y);
      const lon = Math.atan2(direction.x, direction.z);
      const lat = Math.asin(Math.max(-1, Math.min(1, direction.y)));
      // Stay inland: off the coastal bevel and out of the fjords.
      const ground = heightAt(planetRadius, center, lon, lat, 2.5, ["snow"]);
      if (ground <= 0) continue;

      // Height from position: tallest mid-chain, tapering toward both ends,
      // and toward the coast so the range gives way to foothills.
      const middle = 1 - (2 * u - 1) ** 2;
      const inland = -surfaceClearanceOf(planetRadius, direction);
      const coastward = Math.min(1, Math.max(0, (inland - 2) / 9));
      const seed = seededRandom(i * 3.71 + chain * 101.3);
      const height =
        RIDGE_FOOTHILL_HEIGHT +
        (RIDGE_PEAK_HEIGHT - RIDGE_FOOTHILL_HEIGHT) *
          middle *
          coastward *
          (0.82 + seed * 0.36);

      const ahead = surfaceDirection(x + 0.5, y);
      const along = ahead.sub(direction);
      along.addScaledVector(direction, -along.dot(direction)).normalize();

      segments.push({
        position: direction
          .clone()
          .multiplyScalar(planetRadius + ground)
          .add(center),
        normal: direction,
        seed,
        along,
        height,
        width: 1.4 + height * 0.22,
        chain,
      });
    }
  });

  return segments;
};

/** Frosted pines and icy hillocks around the range's feet, for scale. */
export const scatterSnowProps = (
  count: number,
  planetRadius: number,
  center: Vector3,
): ScatteredFeature[] =>
  scatterFeatures(count, planetRadius, center, ["snow"], 2411, 1.5);

/** Penguin colonies on the snow continent. */
export const scatterPenguins = (
  count: number,
  planetRadius: number,
  center: Vector3,
): ScatteredFeature[] =>
  scatterFeatures(count, planetRadius, center, ["snow"], 3571, 2);

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
 * scatterTrees, and like it restricted to the green forest continent (a
 * herd grazes on grass, not on sand or bare rock). A different seed offset
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
