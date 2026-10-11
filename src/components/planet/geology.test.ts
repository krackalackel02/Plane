import { describe, expect, test } from "vitest";
import { Vector3 } from "three";
import {
  GEOLOGY_GEOMETRY,
  TERRACE_TOP_INNER,
  archLayout,
  boulderClusterLayout,
  desertFeatureLayout,
  desertKindOf,
  duneLayout,
  mesaLayout,
  propQuaternion,
  snowPropLayout,
  type GeologyLayout,
  type GeologyPart,
} from "./geology";
import {
  FEATURE_EDGE_MARGIN,
  heightAt,
  placeRockArches,
  scatterDesertFeatures,
  scatterForestRocks,
  scatterSnowProps,
  type ContinentVariant,
  type ScatteredFeature,
} from "./planetTerrain";
import { BIOME_ROCK_MATERIALS } from "./feature";
import { getActivePlanet } from "../../utils/planets";
import { eastNorthAt } from "../../utils/planetSurface";

/**
 * The rock and sand props, measured piece by piece: every vertex the scene
 * draws is rebuilt here in world space (geology.ts holds the same layout the
 * renderer uses) and checked against the terrain under it.
 */

const planet = getActivePlanet();
const center = new Vector3(0, 0, 0);
const R = planet.radius;
const UP = new Vector3(0, 1, 0);

// The populations the scene renders (planet/index.tsx's counts).
const desert = scatterDesertFeatures(70, R, center);
const arches = placeRockArches(R, center);
const forestRocks = scatterForestRocks(24, R, center);
const snowProps = scatterSnowProps(70, R, center);

interface PlacedProp {
  label: string;
  feature: ScatteredFeature;
  layout: GeologyLayout;
  variant: ContinentVariant;
}

const placed: PlacedProp[] = [
  ...desert.map((feature) => ({
    label: `desert ${desertKindOf(feature.seed)}`,
    feature,
    layout: desertFeatureLayout(feature.seed, R),
    variant: "desert" as const,
  })),
  ...arches.map((feature) => ({
    label: "arch",
    feature,
    layout: archLayout(feature.seed, R),
    variant: "desert" as const,
  })),
  ...forestRocks.map((feature) => ({
    label: "forest rocks",
    feature,
    layout: boulderClusterLayout(feature.seed, R),
    variant: "forest" as const,
  })),
  ...snowProps.flatMap((feature) => {
    const layout = snowPropLayout(feature.seed, R);
    return layout
      ? [{ label: "snow prop", feature, layout, variant: "snow" as const }]
      : [];
  }),
];

const lonLatOf = (direction: Vector3): { lon: number; lat: number } => ({
  lon: Math.atan2(direction.x, direction.z),
  lat: Math.asin(Math.max(-1, Math.min(1, direction.y))),
});

const groundHeightToward = (
  point: Vector3,
  variant: ContinentVariant,
  margin = 0,
): number => {
  const { lon, lat } = lonLatOf(point.clone().sub(center).normalize());
  return heightAt(R, center, lon, lat, margin, [variant]);
};

/** How far a world point is above the ground straight beneath it (negative: buried). */
const aboveGround = (point: Vector3, variant: ContinentVariant): number =>
  point.distanceTo(center) - (R + groundHeightToward(point, variant));

interface PartVertex {
  /** The vertex in the shared unit mesh. */
  unit: Vector3;
  /** Scaled and turned with the part, relative to the part's own centre. */
  offset: Vector3;
  world: Vector3;
}

/** A shape's vertices, in its unit mesh. */
const unitVertices = (part: GeologyPart): Vector3[] => {
  const positions = GEOLOGY_GEOMETRY[part.shape].getAttribute("position");
  return Array.from({ length: positions.count }, (_, i) =>
    new Vector3().fromBufferAttribute(positions, i),
  );
};

/**
 * A shape's vertices plus points along every triangle edge - so a ring of
 * the mesh is represented all the way round, not only at its corners.
 */
const unitEdgePoints = (part: GeologyPart): Vector3[] => {
  const geometry = GEOLOGY_GEOMETRY[part.shape];
  const positions = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const corner = (i: number) =>
    new Vector3().fromBufferAttribute(positions, index ? index.getX(i) : i);
  const triangles = (index ? index.count : positions.count) / 3;
  const points: Vector3[] = [];
  for (let t = 0; t < triangles; t++) {
    const [a, b, c] = [corner(3 * t), corner(3 * t + 1), corner(3 * t + 2)];
    for (const [from, to] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      for (let k = 0; k < 6; k++) points.push(from.clone().lerp(to, k / 6));
    }
  }
  return points;
};

/** A part's points (by default its vertices), in world space, exactly as the scene places them. */
const partVertices = (
  prop: PlacedProp,
  part: GeologyPart,
  units: Vector3[] = unitVertices(part),
): PartVertex[] => {
  const facing = propQuaternion(
    prop.layout,
    prop.feature.normal,
    prop.feature.seed,
  );
  const vertices: PartVertex[] = [];
  for (const unit of units) {
    const offset = unit
      .clone()
      .multiply(new Vector3(...part.scale))
      .applyQuaternion(part.quaternion);
    const world = offset
      .clone()
      .add(new Vector3(...part.position))
      .applyQuaternion(facing)
      .add(prop.feature.position);
    vertices.push({ unit, offset, world });
  }
  return vertices;
};

const SECTORS = 8;

/**
 * For a part standing on its rim: in every 45-degree sector round its own
 * axis, how far the lowest of its outermost points sits above the ground.
 * All negative means its edge reaches into the ground on every side - no gap
 * under it anywhere. Edge points, not just vertices: a sheared or oval shape
 * can leave a sector holding only corners from higher up the mesh, though
 * its base ring passes right through that sector.
 */
const rimClearances = (prop: PlacedProp, part: GeologyPart): number[] => {
  const sectors: { reach: number; above: number }[][] = Array.from(
    { length: SECTORS },
    () => [],
  );
  for (const v of partVertices(prop, part, unitEdgePoints(part))) {
    const reach = Math.hypot(v.offset.x, v.offset.z);
    if (reach < 1e-6) continue;
    const angle = Math.atan2(v.offset.z, v.offset.x) + Math.PI;
    const sector = Math.floor((angle / (Math.PI * 2)) * SECTORS) % SECTORS;
    sectors[sector].push({ reach, above: aboveGround(v.world, prop.variant) });
  }
  return sectors
    .filter((entries) => entries.length > 0)
    .map((entries) => {
      const outermost = Math.max(...entries.map((e) => e.reach));
      return Math.min(
        ...entries
          .filter((e) => e.reach >= outermost * 0.85)
          .map((e) => e.above),
      );
    });
};

describe("rock and sand props", () => {
  test("every population is fully placed", () => {
    expect(desert).toHaveLength(70);
    expect(arches).toHaveLength(2);
    expect(forestRocks).toHaveLength(24);
    expect(snowProps).toHaveLength(70);
  });

  // The bug this replaces: props were placed by their centre alone, so a
  // five-unit dune a step from the shore hung out over the sea.
  test("every piece stands over its own flat ground - not the sea, the coast's bevel or a highland step", () => {
    for (const prop of placed) {
      const own = groundHeightToward(
        prop.feature.position,
        prop.variant,
        FEATURE_EDGE_MARGIN,
      );
      expect(own, prop.label).toBeGreaterThan(0);
      for (const part of prop.layout.parts) {
        for (const v of partVertices(prop, part)) {
          expect(
            groundHeightToward(v.world, prop.variant, FEATURE_EDGE_MARGIN),
            prop.label,
          ).toBe(own);
        }
      }
    }
  });

  // The planet curves away under anything wide: a mesa built flat on its own
  // tangent plane would hover at its edge. Each kind of contact is checked
  // the way it actually meets the ground.
  test("every grounded piece touches down, and none is buried out of sight", () => {
    for (const prop of placed) {
      for (const part of prop.layout.parts) {
        if (part.contact === "stacked") continue;
        const vertices = partVertices(prop, part);
        const heights = vertices.map((v) => aboveGround(v.world, prop.variant));
        expect(Math.max(...heights), `${prop.label} visible`).toBeGreaterThan(
          0.05,
        );

        if (part.contact === "base") {
          expect(Math.min(...heights), `${prop.label} base`).toBeLessThan(0);
        } else if (part.contact === "rim") {
          for (const clearance of rimClearances(prop, part)) {
            expect(clearance, `${prop.label} rim`).toBeLessThan(0);
          }
        } else {
          // The arch's two open ends - the tube's end rings - stay buried.
          const ends = vertices.filter((v) => Math.abs(v.unit.y) < 1e-6);
          expect(ends.length).toBeGreaterThan(0);
          for (const v of ends) {
            expect(aboveGround(v.world, prop.variant), "arch end").toBeLessThan(
              0,
            );
          }
        }
      }
    }
  });

  test("rocks vary in size, spin and lean instead of repeating one boulder", () => {
    const rocks = placed.flatMap((prop) =>
      prop.layout.parts.filter((part) => part.contact === "base"),
    );
    expect(rocks.length).toBeGreaterThan(100);

    const sizes = rocks.map((rock) => Math.max(...rock.scale));
    expect(Math.max(...sizes) / Math.min(...sizes)).toBeGreaterThan(4);

    const leans = rocks.map((rock) =>
      UP.clone().applyQuaternion(rock.quaternion).angleTo(UP),
    );
    expect(Math.min(...leans)).toBeLessThan(0.1);
    expect(Math.max(...leans)).toBeGreaterThan(0.45);

    // Spun right round: every eighth of the compass is used.
    const used = new Set(
      rocks.map((rock) => {
        const facing = new Vector3(1, 0, 0).applyQuaternion(rock.quaternion);
        const angle = Math.atan2(facing.z, facing.x) + Math.PI;
        return Math.floor((angle / (Math.PI * 2)) * 8) % 8;
      }),
    );
    expect(used.size).toBe(8);
  });

  test("each biome's rock has its own colour", () => {
    expect(BIOME_ROCK_MATERIALS.desert.rock.color.getHexString()).toBe(
      "b85b37",
    );
    expect(BIOME_ROCK_MATERIALS.snow.rock.color.getHexString()).toBe("52627a");
    expect(BIOME_ROCK_MATERIALS.forest.rock.color.getHexString()).toBe(
      "4a5568",
    );
  });
});

describe("desert geology", () => {
  const mesas = desert.filter((f) => desertKindOf(f.seed) === "mesa");

  test("mesas are terraced: each stratum stepped in from, and resting wholly on, the one below", () => {
    expect(mesas.length).toBeGreaterThanOrEqual(5);
    for (const mesa of mesas) {
      const strata = mesaLayout(mesa.seed, R).parts.filter(
        (part) => part.shape === "terrace",
      );
      expect(strata.length).toBeGreaterThanOrEqual(3);
      expect(strata[0].contact).toBe("rim");

      for (let i = 1; i < strata.length; i++) {
        const below = strata[i - 1];
        const above = strata[i];
        expect(above.contact).toBe("stacked");
        // Strata are ovals: each one's widest and narrowest radius.
        const widest = (part: GeologyPart) =>
          Math.max(part.scale[0], part.scale[2]);
        const narrowest = (part: GeologyPart) =>
          Math.min(part.scale[0], part.scale[2]);
        // A step you can see...
        expect(widest(above)).toBeLessThan(widest(below) * 0.92);
        // ...with this stratum's whole base on the top face below it: its
        // widest reach, off-centre, inside the circle that face holds.
        const offset = Math.hypot(
          above.position[0] - below.position[0],
          above.position[2] - below.position[2],
        );
        expect(offset + widest(above)).toBeLessThanOrEqual(
          TERRACE_TOP_INNER * narrowest(below) + 1e-9,
        );
        // Resting on it: its bottom at, or a hair into, the top below.
        const topBelow = below.position[1] + below.scale[1] / 2;
        const bottomAbove = above.position[1] - above.scale[1] / 2;
        expect(bottomAbove).toBeLessThanOrEqual(topBelow);
        expect(bottomAbove).toBeGreaterThan(topBelow - 0.05);
        // Plumb, so the mesa's top is flat.
        expect(UP.clone().applyQuaternion(above.quaternion).y).toBeCloseTo(
          1,
          9,
        );
      }
    }
  });

  test("gravel rings every mesa's foot", () => {
    for (const mesa of mesas) {
      const parts = mesaLayout(mesa.seed, R).parts;
      const baseRadius = Math.max(parts[0].scale[0], parts[0].scale[2]);
      const pebbles = parts.filter((part) => part.shape === "rock");
      expect(pebbles.length).toBeGreaterThanOrEqual(6);

      const bearings = pebbles
        .map((pebble) => {
          const distance = Math.hypot(pebble.position[0], pebble.position[2]);
          expect(distance).toBeGreaterThan(baseRadius);
          expect(distance).toBeLessThan(baseRadius * 1.4);
          return Math.atan2(pebble.position[2], pebble.position[0]);
        })
        .sort((a, b) => a - b);
      // All the way round, not heaped on one side.
      const gaps = bearings.map((b, i) =>
        i === 0
          ? b + Math.PI * 2 - bearings[bearings.length - 1]
          : b - bearings[i - 1],
      );
      expect(Math.max(...gaps)).toBeLessThan((Math.PI * 2) / 3);
    }
  });

  // A dune field lines up with the wind that built it: every slip face
  // (local +X) points downwind - east - give or take a little.
  test("dunes all face one prevailing wind", () => {
    const dunes = desert.filter((f) => desertKindOf(f.seed) === "dune");
    expect(dunes.length).toBeGreaterThanOrEqual(15);
    for (const dune of dunes) {
      const slipFace = new Vector3(1, 0, 0).applyQuaternion(
        propQuaternion(duneLayout(dune.seed, R), dune.normal, dune.seed),
      );
      const { east } = eastNorthAt(dune.normal);
      expect(slipFace.angleTo(east)).toBeLessThan(0.25);
      // ...and it stays level: the slip face is horizontal, not tipped.
      expect(Math.abs(slipFace.dot(dune.normal))).toBeLessThan(1e-9);
    }
  });

  test("natural rock arches stand on the sand with a real opening, and nothing crowds them", () => {
    expect(arches.length).toBeGreaterThanOrEqual(1);
    for (const arch of arches) {
      const layout = archLayout(arch.seed, R);
      const fin = layout.parts.find((part) => part.shape === "arch");
      expect(fin).toBeDefined();
      if (!fin) continue;
      // Measured on the fin as built: the underside of the crown stands well
      // clear of the ground, and the legs stand well apart.
      const positions = GEOLOGY_GEOMETRY.arch.getAttribute("position");
      let underCrown = Infinity;
      let between = Infinity;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) * fin.scale[0];
        const y = positions.getY(i) * fin.scale[1] + fin.position[1];
        if (Math.abs(x) < 0.5) underCrown = Math.min(underCrown, y);
        if (y > 0 && y < 1) between = Math.min(between, Math.abs(x));
      }
      expect(underCrown).toBeGreaterThan(2);
      expect(2 * between).toBeGreaterThan(4);

      for (const other of desert) {
        const gap =
          arch.position.distanceTo(other.position) -
          layout.footprint -
          desertFeatureLayout(other.seed, R).footprint;
        expect(gap).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
