import { Vector3 } from "three";
import {
  CONTINENTS,
  continentOutlinePoint,
  placeRockArches,
  ridgeChains,
  scatterDesertFeatures,
  scatterTrees,
  type ContinentVariant,
} from "../planet/planetTerrain";
import {
  desertKindOf,
  duneLayout,
  mesaLayout,
  propQuaternion,
  type GeologyLayout,
} from "../planet/geology";

/**
 * The map's terrain as world-space vectors: contour bands for every landmass,
 * canopy crowns for the forest, crest lines and hachures for the mountain
 * chains, dune crests, terraced mesa outlines and arches for the desert.
 *
 * Built once from the very same terrain and props the 3D scene renders (same
 * scatters, same layouts), then reprojected through the ship-centred map
 * projection every frame - so the relief on the map is the relief out of the
 * window, not a separate approximation of it.
 */

// The scene's own counts (planet/index.tsx), so the map shows the same props.
export const TREE_COUNT = 90;
export const DESERT_FEATURE_COUNT = 70;

const OUTLINE_SAMPLES = 160;

/**
 * Hypsometric tints, coast first: each landmass is darkest at its shoreline
 * and brightens inland, the way a topographic map shades rising ground.
 */
export const ELEVATION_RAMPS: Record<ContinentVariant, string[]> = {
  forest: ["#4c9431", "#5fa93a", "#72bc44", "#88cd57"],
  desert: ["#c29d66", "#d1b079", "#dfc28d", "#ebd5a7"],
  // The snow continent's high ground is its mountain chains, not its middle -
  // which is the valley between them - so it takes only a coastal shelf here
  // and its snowfields are drawn along the chains themselves.
  // Both a step greyer than the white snowfields drawn over them.
  snow: ["#aebfcd", "#c6d4df"],
};

/** The forest's raised tan highland, the brightest ground on it. */
export const HIGHLAND_COLOR = "#ecd8a6";

// Contour bands as fractions of the coastline's radius about the centroid.
const CONTINENT_BANDS = [1, 0.76, 0.52, 0.3];
// Islands are a few pixels across - two bands is all that can read.
const ISLAND_BANDS = [1, 0.55];
const SNOW_BANDS = [1, 0.8];
// Below this outline radius a landmass is an island.
const ISLAND_RADIUS = 8;

export interface LandmassRelief {
  variant: ContinentVariant;
  /** Nested outlines - the coastline first, then each contour band inward. */
  bands: Vector3[][];
  /** Each band's fill, darkest at the coast. */
  colors: string[];
  /** The forest's raised highland, if it has one. */
  highland?: Vector3[];
}

export interface CrestRun {
  /** One unbroken run of a chain's crest, in order along it. */
  points: Vector3[];
  /** The ridge's footprint width at each point, for its snowfield. */
  widths: number[];
}

export interface RidgeRelief {
  crests: CrestRun[];
  /** Short strokes down each flank from the crest, longer where it's taller. */
  hachures: [Vector3, Vector3][];
  /** The range's highest summits, for peak silhouettes - tallest first. */
  peaks: { position: Vector3; height: number }[];
}

export interface DesertRelief {
  /** Each dune's crest, end to end - a curve bowed downwind. */
  dunes: Vector3[][];
  /** Each mesa's strata outlines, bottom first. */
  mesas: Vector3[][][];
  arches: Vector3[];
}

export interface MapRelief {
  landmasses: LandmassRelief[];
  /** Tree crowns, drawn merged into woodland outlines. */
  canopy: Vector3[];
  ridges: RidgeRelief;
  desert: DesertRelief;
}

const outline = (
  c: (typeof CONTINENTS)[number],
  planetRadius: number,
  center: Vector3,
  scale: number,
): Vector3[] =>
  Array.from({ length: OUTLINE_SAMPLES }, (_, i) =>
    continentOutlinePoint(
      c,
      planetRadius,
      center,
      (i / OUTLINE_SAMPLES) * Math.PI * 2,
      scale,
    ),
  );

const buildLandmasses = (
  planetRadius: number,
  center: Vector3,
): LandmassRelief[] =>
  CONTINENTS.map((c) => {
    const variant = c.variant ?? "forest";
    const scales =
      variant === "snow"
        ? SNOW_BANDS
        : c.baseRadius < ISLAND_RADIUS
          ? ISLAND_BANDS
          : CONTINENT_BANDS;
    const ramp = ELEVATION_RAMPS[variant];
    return {
      variant,
      bands: scales.map((scale) => outline(c, planetRadius, center, scale)),
      // An island's two bands take the ramp's two ends, coast and crown.
      colors: scales.map(
        (_, i) =>
          ramp[
            scales.length === ramp.length
              ? i
              : Math.round((i / (scales.length - 1)) * (ramp.length - 1))
          ],
      ),
      highland: c.highland
        ? outline(c, planetRadius, center, c.highland.scale)
        : undefined,
    };
  });

// Ridge segments further apart than this along a chain are a gap in it
// (ridgeChains skips points over fjords and the coast), not one crest.
const CREST_GAP = 4;
const PEAK_COUNT = 5;
const PEAK_SPACING = 10;

const buildRidges = (planetRadius: number, center: Vector3): RidgeRelief => {
  const segments = ridgeChains(planetRadius, center);

  const crests: CrestRun[] = [];
  segments.forEach((segment, i) => {
    const previous = segments[i - 1];
    const continues =
      previous &&
      previous.chain === segment.chain &&
      previous.position.distanceTo(segment.position) < CREST_GAP;
    if (!continues) crests.push({ points: [], widths: [] });
    const run = crests[crests.length - 1];
    run.points.push(segment.position);
    run.widths.push(segment.width);
  });

  const hachures: [Vector3, Vector3][] = [];
  for (const segment of segments) {
    const across = segment.normal.clone().cross(segment.along).normalize();
    const length = 1 + segment.height * 0.4;
    for (const side of [1, -1]) {
      hachures.push([
        segment.position,
        segment.position.clone().addScaledVector(across, side * length),
      ]);
    }
  }

  const peaks: RidgeRelief["peaks"] = [];
  for (const segment of [...segments].sort((a, b) => b.height - a.height)) {
    if (peaks.length >= PEAK_COUNT) break;
    if (
      peaks.every(
        (p) => p.position.distanceTo(segment.position) >= PEAK_SPACING,
      )
    ) {
      peaks.push({ position: segment.position, height: segment.height });
    }
  }

  return { crests: crests.filter((c) => c.points.length > 1), hachures, peaks };
};

// Where along a dune its crest is traced, end to end.
const DUNE_CREST_SAMPLES = 7;
// Corners round a mesa stratum - feature.tsx's ten-sided terrace mesh.
const TERRACE_SIDES = 10;

const buildDesert = (planetRadius: number, center: Vector3): DesertRelief => {
  const dunes: Vector3[][] = [];
  const mesas: Vector3[][][] = [];

  for (const feature of scatterDesertFeatures(
    DESERT_FEATURE_COUNT,
    planetRadius,
    center,
  )) {
    const kind = desertKindOf(feature.seed);
    // A point in the prop's own frame, out into the world as the scene puts it.
    const placeIn = (layout: GeologyLayout) => {
      const quaternion = propQuaternion(layout, feature.normal, feature.seed);
      return (local: Vector3) =>
        local.applyQuaternion(quaternion).add(feature.position);
    };

    if (kind === "dune") {
      const layout = duneLayout(feature.seed, planetRadius);
      const place = placeIn(layout);
      const [breadth, , length] = layout.parts[0].scale;
      // The dune mesh's crest: the top of each cross-section, sheared 0.6 of
      // the way downwind (see geology.ts's buildDuneGeometry).
      dunes.push(
        Array.from({ length: DUNE_CREST_SAMPLES }, (_, i) => {
          const along = -0.85 + (1.7 * i) / (DUNE_CREST_SAMPLES - 1);
          const top = Math.sqrt(1 - along * along);
          return place(new Vector3(0.6 * top * breadth, 0, along * length));
        }),
      );
    } else if (kind === "mesa") {
      const layout = mesaLayout(feature.seed, planetRadius);
      const place = placeIn(layout);
      mesas.push(
        layout.parts
          .filter((part) => part.shape === "terrace")
          .map((stratum) =>
            Array.from({ length: TERRACE_SIDES }, (_, k) => {
              const theta = (k / TERRACE_SIDES) * Math.PI * 2;
              return place(
                new Vector3(
                  Math.sin(theta) * stratum.scale[0],
                  0,
                  Math.cos(theta) * stratum.scale[2],
                )
                  .applyQuaternion(stratum.quaternion)
                  .add(
                    new Vector3(stratum.position[0], 0, stratum.position[2]),
                  ),
              );
            }),
          ),
      );
    }
  }

  return {
    dunes,
    mesas,
    arches: placeRockArches(planetRadius, center).map((arch) => arch.position),
  };
};

export const buildMapRelief = (
  planetRadius: number,
  center: Vector3,
): MapRelief => ({
  landmasses: buildLandmasses(planetRadius, center),
  canopy: scatterTrees(TREE_COUNT, planetRadius, center).map(
    (tree) => tree.position,
  ),
  ridges: buildRidges(planetRadius, center),
  desert: buildDesert(planetRadius, center),
});
