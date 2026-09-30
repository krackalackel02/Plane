import { describe, test, expect } from "vitest";
import { Vector3 } from "three";
import {
  CONTINENTS,
  heightAt,
  outlineRadiusAt,
  scatterAnimals,
  scatterBushes,
  scatterDesertFeatures,
  scatterRidges,
  scatterTrees,
  surfaceClearanceAt,
  surfaceClearanceOf,
  surfaceCoverageFraction,
} from "./planetTerrain";
import { getActivePlanet } from "../../utils/planets";
import { eastNorthAt, pointOnSphere } from "../../utils/planetSurface";

const planet = getActivePlanet();
const center = new Vector3(0, 0, 0);

/**
 * A point on a landmass's own coastline, as a unit direction. Built the same
 * way the mesh is (gnomonic: a tangent-plane radius `r` lands at
 * atan(r / planetRadius) of arc from the centroid), so "does this outline
 * overlap that one" is asked about the shapes actually rendered.
 */
const outlineDirection = (
  c: (typeof CONTINENTS)[number],
  bearing: number,
): Vector3 => {
  const centroid = pointOnSphere(1, c.lat, c.lon);
  const { east, north } = eastNorthAt(centroid);
  const theta = Math.atan(outlineRadiusAt(c, bearing) / planet.radius);
  return centroid
    .clone()
    .multiplyScalar(Math.cos(theta))
    .addScaledVector(east, Math.sin(theta) * Math.sin(bearing))
    .addScaledVector(north, Math.sin(theta) * Math.cos(bearing))
    .normalize();
};

/** Latitude/longitude of a unit direction, in the pointOnSphere convention. */
const lonLatOf = (direction: Vector3): { lon: number; lat: number } => ({
  lon: Math.atan2(direction.x, direction.z),
  lat: Math.asin(Math.max(-1, Math.min(1, direction.y))),
});

/** Great-circle clearance (world units) from a unit direction to one landmass's coastline. */
const clearanceToLandmass = (
  c: (typeof CONTINENTS)[number],
  direction: Vector3,
): number => {
  const centroid = pointOnSphere(1, c.lat, c.lon);
  const { east, north } = eastNorthAt(centroid);
  const separation = Math.acos(
    Math.max(-1, Math.min(1, centroid.dot(direction))),
  );
  const bearing = Math.atan2(direction.dot(east), direction.dot(north));
  return (
    (separation - Math.atan(outlineRadiusAt(c, bearing) / planet.radius)) *
    planet.radius
  );
};

describe("CONTINENTS layout", () => {
  // Regression test. With land covering about half the sphere the gaps
  // between landmasses are what the ship's single trail has to thread, so an
  // accidental overlap is both a visual bug and a routing one.
  //
  // Measured by walking each landmass's real coastline and asking every other
  // landmass how far away it is, in great-circle arc. The earlier version
  // compared centroid *chord* distance against the sum of two tangent-plane
  // radii, which are different measures of the same outlines - it agreed with
  // reality on small continents and drifted badly as they grew.
  test("no two landmasses overlap, with real clearance between them", () => {
    let worstGap = Infinity;
    let worstPair = "";

    for (let i = 0; i < CONTINENTS.length; i++) {
      for (let k = 0; k < 240; k++) {
        const bearing = (k / 240) * Math.PI * 2;
        const coastPoint = outlineDirection(CONTINENTS[i], bearing);
        for (let j = 0; j < CONTINENTS.length; j++) {
          if (i === j) continue;
          const gap = clearanceToLandmass(CONTINENTS[j], coastPoint);
          if (gap < worstGap) {
            worstGap = gap;
            worstPair = `${i} <-> ${j}`;
          }
        }
      }
    }

    expect(
      worstGap,
      `closest pair ${worstPair} at ${worstGap.toFixed(2)}u`,
    ).toBeGreaterThan(3);
  });

  // The whole point of this layout: the planet should read as roughly half
  // land, not as an ocean with a few islands in it.
  // Land is deliberately around a third of the sphere rather than half: every
  // project's stop has to sit in genuinely open water (see
  // calculatedBoardPositionsAndRotations' MIN_BOARD_WATER), and at ~50% land
  // the deepest water anywhere on the planet was only 18 units - not enough to
  // stand a billboard in without it clipping the coastline behind it.
  test("land covers about a third of the planet's surface", () => {
    const coverage = surfaceCoverageFraction(planet.radius);
    expect(coverage).toBeGreaterThan(0.3);
    expect(coverage).toBeLessThan(0.4);
  });

  test("has exactly one continent of each biome", () => {
    const variants = CONTINENTS.map((c) => c.variant ?? "forest");
    expect(variants.filter((v) => v === "desert")).toHaveLength(1);
    expect(variants.filter((v) => v === "snow")).toHaveLength(1);
    expect(CONTINENTS.filter((c) => c.baseRadius > 20)).toHaveLength(3);
  });
});

describe("heightAt", () => {
  test("is 0 over open ocean", () => {
    // Derived rather than hardcoded: an earlier version of this test pinned a
    // specific latitude with a comment about where the continents were, and
    // rotted the moment they moved. Find genuinely open water instead.
    let found = false;
    for (let i = 0; i < 2000 && !found; i++) {
      const lon = (i / 2000) * Math.PI * 2;
      for (const latDeg of [-80, -70, 0, 70, 80]) {
        const lat = (latDeg * Math.PI) / 180;
        if (surfaceClearanceAt(planet.radius, lon, lat) > 5) {
          expect(heightAt(planet.radius, center, lon, lat)).toBe(0);
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  test("is positive at every landmass's own centroid", () => {
    for (const c of CONTINENTS) {
      expect(heightAt(planet.radius, center, c.lon, c.lat)).toBeGreaterThan(0);
    }
  });

  test("the snow continent carries a scattered mountain range", () => {
    const snow = CONTINENTS.find((c) => c.variant === "snow");
    expect(snow).toBeDefined();
    if (!snow) return;

    // Peaks are separate scattered props rather than one inset plateau cap -
    // a single cap is what made the continent read as a flat white dome.
    expect(snow.highland).toBeUndefined();

    const ridges = scatterRidges(14, planet.radius, center);
    expect(ridges.length).toBeGreaterThan(20);
    for (const segment of ridges) {
      const { lon, lat } = lonLatOf(segment.normal);
      expect(
        heightAt(planet.radius, center, lon, lat, 0, ["snow"]),
      ).toBeGreaterThan(0);
    }

    // Segments must vary in height, or the "range" is a plateau of clones.
    const heights = ridges.map((r) => r.height);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(2);

    // Ridges run in chains, so consecutive segments sit close enough together
    // to interpenetrate rather than standing apart as separate cones.
    let touching = 0;
    for (let i = 1; i < ridges.length; i++) {
      if (
        ridges[i].position.distanceTo(ridges[i - 1].position) <
        ridges[i].width * 2
      ) {
        touching++;
      }
    }
    expect(touching).toBeGreaterThan(ridges.length / 2);
  });

  test("desert features and bushes land on their own biome only", () => {
    for (const feature of scatterDesertFeatures(40, planet.radius, center)) {
      const { lon, lat } = lonLatOf(feature.normal);
      expect(
        heightAt(planet.radius, center, lon, lat, 0, ["desert"]),
      ).toBeGreaterThan(0);
    }
    for (const bush of scatterBushes(60, planet.radius, center)) {
      const { lon, lat } = lonLatOf(bush.normal);
      expect(
        heightAt(planet.radius, center, lon, lat, 0, ["forest"]),
      ).toBeGreaterThan(0);
    }
  });
});

describe("scatterTrees", () => {
  // Regression test: trees used to be placed via a chord-based
  // approximation that disagreed with the mesh's own gnomonic projection,
  // letting some land in open water. Every scattered tree must sit on
  // actual (margin-respecting) land.
  test("every tree lands on land, never on open ocean", () => {
    const trees = scatterTrees(40, planet.radius, center);
    expect(trees.length).toBeGreaterThan(0);
    for (const tree of trees) {
      expect(tree.position.distanceTo(center)).toBeGreaterThan(planet.radius);
      expect(
        surfaceClearanceOf(planet.radius, tree.normal),
      ).toBeLessThanOrEqual(0);
    }
  });

  // The desert is bare sand and the snow continent is bare rock - the whole
  // point of having three biomes is that they don't all look the same.
  test("never lands on the desert or the snow continent", () => {
    const trees = scatterTrees(200, planet.radius, center);
    expect(trees.length).toBeGreaterThan(0);
    for (const tree of trees) {
      const { lon, lat } = lonLatOf(tree.normal);
      expect(heightAt(planet.radius, center, lon, lat, 0, ["desert"])).toBe(0);
      expect(heightAt(planet.radius, center, lon, lat, 0, ["snow"])).toBe(0);
    }
  });
});

describe("scatterAnimals", () => {
  test("every animal grazes on green land only", () => {
    const animals = scatterAnimals(14, planet.radius, center);
    expect(animals.length).toBeGreaterThan(0);
    for (const animal of animals) {
      const { lon, lat } = lonLatOf(animal.normal);
      expect(
        heightAt(planet.radius, center, lon, lat, 0, ["forest"]),
      ).toBeGreaterThan(0);
      expect(heightAt(planet.radius, center, lon, lat, 0, ["desert"])).toBe(0);
      expect(heightAt(planet.radius, center, lon, lat, 0, ["snow"])).toBe(0);
    }
  });
});
