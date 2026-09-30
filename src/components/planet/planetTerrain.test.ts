import { describe, test, expect } from "vitest";
import { Vector3 } from "three";
import {
  CONTINENTS,
  SAFE_LAT_DEG,
  heightAt,
  outlineRadiusAt,
  scatterTrees,
} from "./planetTerrain";
import { getActivePlanet } from "../../utils/planets";

const planet = getActivePlanet();
const center = new Vector3(0, 0, 0);

const maxOutlineRadius = (c: (typeof CONTINENTS)[number]): number => {
  let max = 0;
  for (let i = 0; i < 360; i++) {
    max = Math.max(max, outlineRadiusAt(c, (i / 360) * Math.PI * 2));
  }
  return max;
};

describe("CONTINENTS layout", () => {
  // Regression test: continents used to sit near the equator and overlap
  // the ship's trail, boards, and activation zones. Every continent must
  // stay clear of the trail's whole possible reach (see SAFE_LAT_DEG),
  // with margin, even at its widest (wobbled) point.
  test("every continent's closest edge clears the trail/board/zone corridor", () => {
    for (const c of CONTINENTS) {
      const centroidLatDeg = (Math.abs(c.lat) * 180) / Math.PI;
      const maxRadiusDeg =
        (maxOutlineRadius(c) / planet.radius) * (180 / Math.PI);
      const innermostReachDeg = centroidLatDeg - maxRadiusDeg;
      expect(innermostReachDeg).toBeGreaterThan(SAFE_LAT_DEG);
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
});
