import { describe, test, expect } from "vitest";
import { Vector3 } from "three";
import {
  CONTINENTS,
  DESERT_HEIGHT,
  GREEN_HEIGHT,
  SNOW_BASE_HEIGHT,
  SNOW_HEIGHT,
  TAN_HEIGHT,
  TERRAIN_EMBED,
  bevelThicknessFor,
  capBaseZOffset,
  heightAt,
  scatterAnimals,
  scatterTrees,
} from "./planetTerrain";
import { buildConformingGeometry } from "./landmass";
import { getActivePlanet } from "../../utils/planets";
import {
  eastNorthAt,
  pointOnSphere,
  surfaceNormal,
} from "../../utils/planetSurface";

/**
 * Geometric "does it actually touch?" tests.
 *
 * Everything else in the suite checks the maths that *decides* where things
 * go. These check the thing you'd otherwise only catch by looking at the
 * screen: that the rendered surfaces meet the surfaces they're supposed to be
 * sitting on, with no gap and nothing sunk through.
 */

const planet = getActivePlanet();
const center = new Vector3(0, 0, 0);

const lonLatOf = (direction: Vector3): { lon: number; lat: number } => ({
  lon: Math.atan2(direction.x, direction.z),
  lat: Math.asin(Math.max(-1, Math.min(1, direction.y))),
});

/** The base layer's extrusion depth for a landmass, by biome. */
const baseDepthOf = (c: (typeof CONTINENTS)[number]): number => {
  if (c.variant === "desert") return DESERT_HEIGHT;
  return c.variant === "snow" ? SNOW_BASE_HEIGHT : GREEN_HEIGHT;
};

/** Builds a landmass's real base geometry, exactly as the scene does. */
const buildBase = (c: (typeof CONTINENTS)[number]) => {
  const centroidPos = pointOnSphere(planet.radius, c.lat, c.lon, center);
  const { east, north } = eastNorthAt(surfaceNormal(centroidPos, center));
  return buildConformingGeometry(
    c,
    1,
    baseDepthOf(c),
    planet.radius,
    center,
    centroidPos,
    east,
    north,
    0,
  );
};

/**
 * Radii of every triangle's centroid. Vertices alone are not enough: a flat
 * triangle spanning a chord has all three corners exactly on the sphere while
 * its middle cuts straight through it, which is precisely the failure this is
 * here to catch.
 */
const triangleCentroidRadii = (geometry: {
  getAttribute: (name: string) => {
    count: number;
    getX: (i: number) => number;
    getY: (i: number) => number;
    getZ: (i: number) => number;
  };
  getIndex: () => { count: number; getX: (i: number) => number } | null;
}): number[] => {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const at = (i: number): number => (index ? index.getX(i) : i);
  const radii: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();

  for (let i = 0; i + 2 < count; i += 3) {
    const ia = at(i);
    const ib = at(i + 1);
    const ic = at(i + 2);
    a.set(position.getX(ia), position.getY(ia), position.getZ(ia));
    b.set(position.getX(ib), position.getY(ib), position.getZ(ib));
    c.set(position.getX(ic), position.getY(ic), position.getZ(ic));
    radii.push(a.add(b).add(c).divideScalar(3).distanceTo(center));
  }
  return radii;
};

describe("landmass surfaces conform to the planet", () => {
  // Regression test for continents rendering as flat slabs slicing through
  // the globe. ExtrudeGeometry triangulates its caps from the outline
  // vertices alone, so before landmass.tsx tessellated them, wrapping only
  // moved the rim onto the sphere and every cap triangle stayed a flat plane
  // across the chord. At the continents' current size those chords are ~90
  // world units, which sags about 25 units - a quarter of the way to the
  // planet's core. Checking triangle centroids (not vertices) is what
  // distinguishes a bent surface from a flat one.
  test("no landmass triangle sinks into the planet", () => {
    for (const c of CONTINENTS) {
      const geometry = buildBase(c);
      const radii = triangleCentroidRadii(geometry);
      expect(radii.length).toBeGreaterThan(0);

      const deepest = Math.min(...radii);
      const floor =
        planet.radius - bevelThicknessFor(baseDepthOf(c)) - TERRAIN_EMBED;
      expect(
        deepest,
        `landmass at lon ${((c.lon * 180) / Math.PI).toFixed(0)} dips to ${deepest.toFixed(2)} (floor ${floor.toFixed(2)})`,
      ).toBeGreaterThan(floor - 0.25);
      geometry.dispose();
    }
  });

  test("no landmass floats above its own extruded height", () => {
    for (const c of CONTINENTS) {
      const geometry = buildBase(c);
      const highest = Math.max(...triangleCentroidRadii(geometry));
      const ceiling =
        planet.radius +
        baseDepthOf(c) +
        bevelThicknessFor(baseDepthOf(c)) -
        TERRAIN_EMBED;
      expect(highest).toBeLessThan(ceiling + 0.25);
      geometry.dispose();
    }
  });

  // The base is embedded exactly TERRAIN_EMBED into the ocean shell - deep
  // enough to hide the seam, not so deep that the coastline visibly sinks.
  test("every landmass meets the ocean shell flush, with no gap", () => {
    for (const c of CONTINENTS) {
      const geometry = buildBase(c);
      const position = geometry.getAttribute("position");
      let lowestVertex = Infinity;
      const v = new Vector3();
      for (let i = 0; i < position.count; i++) {
        v.set(position.getX(i), position.getY(i), position.getZ(i));
        lowestVertex = Math.min(lowestVertex, v.distanceTo(center));
      }
      expect(lowestVertex).toBeCloseTo(
        planet.radius - bevelThicknessFor(baseDepthOf(c)) - TERRAIN_EMBED,
        4,
      );
      geometry.dispose();
    }
  });

  // A highland/peak cap has to land on top of its own base layer, not float
  // over it or sink inside it.
  test("each cap layer sits exactly on the base beneath it", () => {
    for (const c of CONTINENTS) {
      if (!c.highland) continue;
      const variant = c.variant ?? "forest";
      const centroidPos = pointOnSphere(planet.radius, c.lat, c.lon, center);
      const { east, north } = eastNorthAt(surfaceNormal(centroidPos, center));
      const cap = buildConformingGeometry(
        c,
        c.highland.scale,
        variant === "snow" ? SNOW_HEIGHT : TAN_HEIGHT,
        planet.radius,
        center,
        centroidPos,
        east,
        north,
        capBaseZOffset(variant),
      );

      const position = cap.getAttribute("position");
      let lowest = Infinity;
      const v = new Vector3();
      for (let i = 0; i < position.count; i++) {
        v.set(position.getX(i), position.getY(i), position.getZ(i));
        lowest = Math.min(lowest, v.distanceTo(center));
      }
      // The cap's underside sits TERRAIN_EMBED below the base's top surface,
      // which is exactly what hides the join.
      const baseTop =
        planet.radius +
        baseDepthOf(c) +
        bevelThicknessFor(baseDepthOf(c)) -
        TERRAIN_EMBED;
      expect(lowest).toBeCloseTo(baseTop - TERRAIN_EMBED, 4);
      cap.dispose();
    }
  });
});

describe("scattered props touch the ground they stand on", () => {
  // heightAt is the single source of truth for "where is the ground here",
  // and the mesh is built to agree with it (see wrapGeometryOntoSphere). So
  // a prop standing exactly at planetRadius + heightAt is standing exactly on
  // the rendered surface - not hovering above it, not sunk into it.
  test("every tree's base sits exactly on the terrain height at its own spot", () => {
    const trees = scatterTrees(90, planet.radius, center);
    expect(trees.length).toBeGreaterThan(0);

    for (const tree of trees) {
      const { lon, lat } = lonLatOf(tree.normal);
      const ground = heightAt(planet.radius, center, lon, lat);
      expect(ground).toBeGreaterThan(0);
      expect(tree.position.distanceTo(center)).toBeCloseTo(
        planet.radius + ground,
        6,
      );
    }
  });

  test("every animal stands exactly on the terrain height at its own spot", () => {
    const animals = scatterAnimals(14, planet.radius, center);
    expect(animals.length).toBeGreaterThan(0);

    for (const animal of animals) {
      const { lon, lat } = lonLatOf(animal.normal);
      const ground = heightAt(planet.radius, center, lon, lat);
      expect(ground).toBeGreaterThan(0);
      expect(animal.position.distanceTo(center)).toBeCloseTo(
        planet.radius + ground,
        6,
      );
    }
  });

  // Their "up" has to be the true radial direction at their own spot, or they
  // lean visibly on a sphere this small.
  test("props stand upright along their own surface normal", () => {
    for (const prop of [
      ...scatterTrees(30, planet.radius, center),
      ...scatterAnimals(10, planet.radius, center),
    ]) {
      const trueNormal = prop.position.clone().sub(center).normalize();
      expect(prop.normal.distanceTo(trueNormal)).toBeLessThan(1e-6);
    }
  });
});
