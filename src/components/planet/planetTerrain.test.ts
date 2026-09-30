import { describe, test, expect } from "vitest";
import { Vector3 } from "three";
import {
  CONTINENTS,
  CORRIDOR_HALF_WIDTH,
  heightAt,
  minDistanceToPath,
  outlineRadiusAt,
  scatterTrees,
} from "./planetTerrain";
import { getActivePlanet } from "../../utils/planets";
import { pointOnSphere } from "../../utils/planetSurface";

const planet = getActivePlanet();
const center = new Vector3(0, 0, 0);

const maxOutlineRadius = (c: (typeof CONTINENTS)[number]): number => {
  let max = 0;
  for (let i = 0; i < 360; i++) {
    max = Math.max(max, outlineRadiusAt(c, (i / 360) * Math.PI * 2));
  }
  return max;
};

/** Great-circle distance (world units) between two continents' centroids. */
const centroidDistance = (
  a: (typeof CONTINENTS)[number],
  b: (typeof CONTINENTS)[number],
): number =>
  pointOnSphere(planet.radius, a.lat, a.lon, center).distanceTo(
    pointOnSphere(planet.radius, b.lat, b.lon, center),
  );

describe("CONTINENTS layout", () => {
  // Regression test: continents used to sit near the equator and overlap
  // the ship's trail, boards, and activation zones. Every continent's
  // closest possible edge (its centroid's own closest approach to the
  // actual wiggly trail, minus its own widest outline radius) must clear
  // the corridor the trail/boards/zones actually need - a real per-point
  // check against the trail's own path, not a blanket latitude line, so
  // landmasses can sit anywhere the trail's wiggle happens to leave clear.
  test("every continent's closest edge clears the trail/board/zone corridor", () => {
    for (const c of CONTINENTS) {
      const clearance =
        minDistanceToPath(planet.radius, center, c.lon, c.lat) -
        maxOutlineRadius(c);
      expect(clearance).toBeGreaterThan(CORRIDOR_HALF_WIDTH);
    }
  });

  // Regression test: adding more (smaller) islands to fill the gaps
  // between continents makes accidental overlap an easy mistake - every
  // pair's centroids must stay farther apart than the sum of their own
  // widest outline radii, with a little breathing room.
  test("no two continents/islands overlap", () => {
    for (let i = 0; i < CONTINENTS.length; i++) {
      for (let j = i + 1; j < CONTINENTS.length; j++) {
        const a = CONTINENTS[i];
        const b = CONTINENTS[j];
        const clearance =
          centroidDistance(a, b) - maxOutlineRadius(a) - maxOutlineRadius(b);
        expect(clearance).toBeGreaterThan(0);
      }
    }
  });
});

describe("heightAt", () => {
  test("is 0 over open ocean (far from every continent)", () => {
    expect(heightAt(planet.radius, center, 0, 0)).toBe(0);
  });

  test("is positive exactly at a continent's own centroid", () => {
    const [c] = CONTINENTS;
    expect(heightAt(planet.radius, center, c.lon, c.lat)).toBeGreaterThan(0);
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
      const distance = tree.position.distanceTo(center);
      expect(distance).toBeGreaterThan(planet.radius);
    }
  });

  test("never lands on a desert continent", () => {
    const desert = CONTINENTS.find((c) => c.variant === "desert");
    expect(desert).toBeDefined();
    if (!desert) return;

    const trees = scatterTrees(200, planet.radius, center);
    for (const tree of trees) {
      const normal = tree.normal;
      const lat = Math.asin(Math.max(-1, Math.min(1, normal.y)));
      const lon = Math.atan2(normal.x, normal.z);
      const onDesert = heightAt(planet.radius, center, lon, lat, 0, ["desert"]);
      expect(onDesert).toBe(0);
    }
  });
});
