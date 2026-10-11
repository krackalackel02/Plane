import { describe, expect, test } from "vitest";
import { Vector3 } from "three";
import {
  DESERT_FEATURE_COUNT,
  ELEVATION_RAMPS,
  HIGHLAND_COLOR,
  TREE_COUNT,
  buildMapRelief,
} from "./mapRelief";
import {
  CONTINENTS,
  heightAt,
  placeRockArches,
  ridgeChains,
  scatterDesertFeatures,
  scatterTrees,
  type ContinentVariant,
} from "../planet/planetTerrain";
import { desertKindOf, mesaLayout } from "../planet/geology";
import { getActivePlanet } from "../../utils/planets";
import { eastNorthAt, pointOnSphere } from "../../utils/planetSurface";

const planet = getActivePlanet();
const center = new Vector3(0, 0, 0);
const R = planet.radius;
const relief = buildMapRelief(R, center);

/** Relative luminance of a #rrggbb colour (WCAG). */
const luminance = (hex: string): number => {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
};

const onLand = (point: Vector3, variant: ContinentVariant): boolean => {
  const d = point.clone().sub(center).normalize();
  return (
    heightAt(
      R,
      center,
      Math.atan2(d.x, d.z),
      Math.asin(Math.max(-1, Math.min(1, d.y))),
      0,
      [variant],
    ) > 0
  );
};

describe("map relief: landmasses", () => {
  test("every landmass is shaded darkest at its coast, brightening inland", () => {
    for (const ramp of Object.values(ELEVATION_RAMPS)) {
      for (let i = 1; i < ramp.length; i++) {
        expect(luminance(ramp[i])).toBeGreaterThan(luminance(ramp[i - 1]));
      }
    }
    for (const land of relief.landmasses) {
      expect(land.colors).toHaveLength(land.bands.length);
      for (let i = 1; i < land.colors.length; i++) {
        expect(luminance(land.colors[i])).toBeGreaterThan(
          luminance(land.colors[i - 1]),
        );
      }
      // The forest's raised highland is brighter still.
      if (land.highland) {
        expect(luminance(HIGHLAND_COLOR)).toBeGreaterThan(
          luminance(land.colors[land.colors.length - 1]),
        );
      }
    }
  });

  test("contour bands nest one inside the next, the coastline outermost", () => {
    relief.landmasses.forEach((land, l) => {
      const c = CONTINENTS[l];
      const centroid = pointOnSphere(1, c.lat, c.lon);
      const reach = (p: Vector3) => p.clone().normalize().angleTo(centroid);
      for (let b = 1; b < land.bands.length; b++) {
        land.bands[b].forEach((point, i) => {
          expect(reach(point)).toBeLessThan(reach(land.bands[b - 1][i]));
        });
      }
    });
  });

  test("continents get several contour bands; the snow continent's high ground is its chains", () => {
    for (const land of relief.landmasses) {
      const c = CONTINENTS[relief.landmasses.indexOf(land)];
      if (land.variant === "snow") {
        // Its middle is the valley between the chains, not a summit - so no
        // concentric bands brightening into it.
        expect(land.bands.length).toBeLessThanOrEqual(2);
      } else if (c.baseRadius > 20) {
        expect(land.bands.length).toBeGreaterThanOrEqual(4);
      }
    }
  });
});

describe("map relief: patterns from the scene's own terrain", () => {
  test("the woodland is the scene's own trees", () => {
    const trees = scatterTrees(TREE_COUNT, R, center);
    expect(relief.canopy).toHaveLength(trees.length);
    relief.canopy.forEach((crown, i) => {
      expect(crown.distanceTo(trees[i].position)).toBeLessThan(1e-9);
    });
  });

  test("snowfields and crest lines follow both mountain chains", () => {
    const segments = ridgeChains(R, center);
    const segmentAt = (point: Vector3) =>
      segments.find((s) => s.position.distanceTo(point) < 1e-9);
    const crestPoints = relief.ridges.crests.flatMap((run) => run.points);
    // Every ridge segment is on a crest line, bar the odd one standing alone
    // past a gap in its chain - a single point draws no line (it still gets
    // its hachures).
    for (const point of crestPoints) expect(segmentAt(point)).toBeDefined();
    expect(crestPoints.length).toBeGreaterThanOrEqual(segments.length - 2);
    const chains = new Set(
      relief.ridges.crests.map((run) => segmentAt(run.points[0])?.chain),
    );
    expect(chains).toEqual(new Set([0, 1]));
    for (const point of crestPoints) expect(onLand(point, "snow")).toBe(true);
  });

  // Hachures are drawn down the slope - straight across the chain - and
  // longer where the range stands taller.
  test("hachures run down the flanks, longer under taller peaks", () => {
    const segments = ridgeChains(R, center);
    expect(relief.ridges.hachures).toHaveLength(segments.length * 2);
    segments.forEach((segment, i) => {
      for (const [from, to] of relief.ridges.hachures.slice(2 * i, 2 * i + 2)) {
        expect(from.distanceTo(segment.position)).toBeLessThan(1e-9);
        const down = to.clone().sub(from);
        expect(
          Math.abs(down.clone().normalize().dot(segment.along)),
        ).toBeLessThan(1e-9);
        expect(down.length()).toBeCloseTo(1 + segment.height * 0.4, 9);
      }
    });
  });

  test("peak silhouettes mark the tallest summits, spread out", () => {
    const tallest = Math.max(...ridgeChains(R, center).map((s) => s.height));
    const { peaks } = relief.ridges;
    expect(peaks.length).toBeGreaterThanOrEqual(3);
    expect(peaks.length).toBeLessThanOrEqual(5);
    expect(peaks[0].height).toBe(tallest);
    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i].height).toBeLessThanOrEqual(peaks[i - 1].height);
    }
    for (const a of peaks) {
      for (const b of peaks) {
        if (a !== b) {
          expect(a.position.distanceTo(b.position)).toBeGreaterThanOrEqual(10);
        }
      }
    }
  });

  // The crest bows out on the downwind side of the line between its ends -
  // measured across the dune's own chord, since each dune sits a few degrees
  // either side of due east.
  test("dune lines trace each dune's crest, bowed downwind", () => {
    const dunes = scatterDesertFeatures(DESERT_FEATURE_COUNT, R, center).filter(
      (f) => desertKindOf(f.seed) === "dune",
    );
    expect(relief.desert.dunes).toHaveLength(dunes.length);
    relief.desert.dunes.forEach((crest, i) => {
      const { normal } = dunes[i];
      const { east } = eastNorthAt(normal);
      const start = crest[0];
      const chord = crest[crest.length - 1].clone().sub(start);
      const across = normal.clone().cross(chord).normalize();
      if (across.dot(east) < 0) across.negate();
      // The wind blows across the dune, not along it.
      expect(across.dot(east)).toBeGreaterThan(0.9);
      const middle = crest[Math.floor(crest.length / 2)];
      expect(middle.clone().sub(start).dot(across)).toBeGreaterThan(0.2);
      for (const point of crest) expect(onLand(point, "desert")).toBe(true);
    });
  });

  test("terraced contours are each mesa's own strata, nested", () => {
    const mesas = scatterDesertFeatures(DESERT_FEATURE_COUNT, R, center).filter(
      (f) => desertKindOf(f.seed) === "mesa",
    );
    expect(relief.desert.mesas).toHaveLength(mesas.length);
    relief.desert.mesas.forEach((rings, i) => {
      const strata = mesaLayout(mesas[i].seed, R).parts.filter(
        (part) => part.shape === "terrace",
      );
      expect(rings).toHaveLength(strata.length);
      // Each ring sits wholly within the one below it.
      const spread = (ring: Vector3[]) => {
        const middle = ring
          .reduce((sum, p) => sum.add(p), new Vector3())
          .divideScalar(ring.length);
        return Math.max(...ring.map((p) => p.distanceTo(middle)));
      };
      for (let r = 1; r < rings.length; r++) {
        expect(spread(rings[r])).toBeLessThan(spread(rings[r - 1]));
      }
    });
  });

  test("arches are marked where the scene stands them", () => {
    const arches = placeRockArches(R, center);
    expect(relief.desert.arches).toHaveLength(arches.length);
    relief.desert.arches.forEach((arch, i) => {
      expect(arch.distanceTo(arches[i].position)).toBeLessThan(1e-9);
    });
  });
});
