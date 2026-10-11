import { describe, test, expect } from "vitest";
import { Vector3 } from "three";
import {
  CONTINENTS,
  heightAt,
  outlineRadiusAt,
  scatterAnimals,
  scatterBushes,
  scatterDesertFeatures,
  ridgeChains,
  scatterTrees,
  surfaceClearanceAt,
  surfaceClearanceOf,
  surfaceClearanceWithGradient,
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

describe("surfaceClearanceWithGradient", () => {
  // The trail's elastic band steers by this gradient every iteration, so it
  // has to be the true derivative of the clearance - fjord notches included.
  test("matches central differences of the clearance itself", () => {
    let worst = 0;
    for (let i = 0; i < 300; i++) {
      const lat = Math.sin(i * 12.9898) * 1.3;
      const lon = (i * 2.399) % (Math.PI * 2);
      const d = pointOnSphere(1, lat, lon);
      const { clearance, gradient } = surfaceClearanceWithGradient(
        planet.radius,
        d,
      );
      if (clearance < 0.5) continue; // not differentiable across a coast
      const { east, north } = eastNorthAt(d);
      const h = 1e-5;
      const step = (t: typeof east, a: number) =>
        d
          .clone()
          .multiplyScalar(Math.cos(a))
          .addScaledVector(t, Math.sin(a))
          .normalize();
      const fe =
        (surfaceClearanceOf(planet.radius, step(east, h)) -
          surfaceClearanceOf(planet.radius, step(east, -h))) /
        (2 * h * planet.radius);
      const fn =
        (surfaceClearanceOf(planet.radius, step(north, h)) -
          surfaceClearanceOf(planet.radius, step(north, -h))) /
        (2 * h * planet.radius);
      worst = Math.max(
        worst,
        Math.abs(fe - gradient.dot(east)),
        Math.abs(fn - gradient.dot(north)),
      );
    }
    expect(worst).toBeLessThan(1e-5);
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

  describe("the snow continent's mountain range", () => {
    const ridges = ridgeChains(planet.radius, center);
    const chains = [0, 1].map((c) => ridges.filter((r) => r.chain === c));

    test("is two chains of segments, all standing on the snow", () => {
      const snow = CONTINENTS.find((c) => c.variant === "snow");
      // Peaks are props, not one inset plateau cap - a single cap is what
      // made the continent read as a flat white dome.
      expect(snow?.highland).toBeUndefined();
      expect(chains[0].length).toBeGreaterThan(8);
      expect(chains[1].length).toBeGreaterThan(8);
      for (const segment of ridges) {
        const { lon, lat } = lonLatOf(segment.normal);
        expect(
          heightAt(planet.radius, center, lon, lat, 0, ["snow"]),
        ).toBeGreaterThan(0);
      }
    });

    // Fewer, deliberate mountains: the scattered version had ~90 segments
    // ringing the coast.
    test("uses a restrained number of segments", () => {
      expect(ridges.length).toBeLessThan(60);
    });

    // Each chain is continuous: consecutive segments overlap, so a run of
    // them renders as one crest rather than a row of separate peaks.
    test("each chain is a continuous crest", () => {
      for (const chain of chains) {
        let joined = 0;
        for (let i = 1; i < chain.length; i++) {
          if (
            chain[i].position.distanceTo(chain[i - 1].position) <
            chain[i].width * 2.5
          ) {
            joined++;
          }
        }
        expect(joined).toBeGreaterThan((chain.length - 1) * 0.8);
      }
    });

    // Tallest in the middle of a chain, tapering to foothills at its ends.
    test("rises to central summits and tapers to foothills", () => {
      for (const chain of chains) {
        const heights = chain.map((r) => r.height);
        const peak = Math.max(...heights);
        expect(peak).toBeGreaterThan(5);
        expect(heights[0]).toBeLessThan(peak * 0.6);
        expect(heights[heights.length - 1]).toBeLessThan(peak * 0.6);
      }
    });

    // The pass: the two chains never close the valley between them.
    test("keeps an open valley between the chains", () => {
      for (const a of chains[0]) {
        const nearest = Math.min(
          ...chains[1].map((b) => a.position.distanceTo(b.position)),
        );
        expect(nearest).toBeGreaterThan(12);
      }
    });

    // Every segment's crest runs along its own chain, which is what lines the
    // segments up into a ridge at all.
    test("orients every segment along its chain", () => {
      for (const chain of chains) {
        for (let i = 1; i < chain.length - 1; i++) {
          const run = chain[i + 1].position
            .clone()
            .sub(chain[i - 1].position)
            .normalize();
          if (chain[i + 1].position.distanceTo(chain[i - 1].position) > 8)
            continue; // gap in the chain
          expect(Math.abs(run.dot(chain[i].along))).toBeGreaterThan(0.85);
        }
      }
    });
  });

  test("the snow continent's coast is cut by fjords", () => {
    const snow = CONTINENTS.find((c) => c.variant === "snow");
    expect(snow?.inlets?.length ?? 0).toBeGreaterThanOrEqual(3);
    const withoutInlets = { ...snow!, inlets: [] };
    for (const inlet of snow?.inlets ?? []) {
      // Each notch cuts the coast in by (nearly) its full depth at its own
      // bearing, compared with the same coastline without any inlets.
      const cut =
        outlineRadiusAt(withoutInlets, inlet.bearing) -
        outlineRadiusAt(snow!, inlet.bearing);
      expect(cut).toBeGreaterThan(snow!.baseRadius * inlet.depth * 0.95);
      // ...and it is narrow: three half-widths away it's almost gone.
      const away =
        outlineRadiusAt(withoutInlets, inlet.bearing + inlet.width * 3) -
        outlineRadiusAt(snow!, inlet.bearing + inlet.width * 3);
      expect(away).toBeLessThan(cut * 0.05);
    }
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
