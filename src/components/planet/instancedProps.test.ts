import { describe, expect, test } from "vitest";
import {
  BoxGeometry,
  MeshBasicMaterial,
  Matrix4,
  Object3D,
  Vector3,
} from "three";
import {
  batchInstances,
  composeMatrix,
  type PropInstance,
} from "./instancedProps";
import {
  archInstances,
  bushInstances,
  desertInstances,
  forestRockInstances,
  geologyInstances,
  ridgeInstances,
  snowPropInstances,
} from "./feature";
import {
  placeRockArches,
  ridgeChains,
  scatterBushes,
  scatterDesertFeatures,
  scatterForestRocks,
  scatterSnowProps,
} from "./planetTerrain";
import { desertFeatureLayout, propQuaternion } from "./geology";
import { getActivePlanet } from "../../utils/planets";

const planet = getActivePlanet();
const center = new Vector3(0, 0, 0);
const R = planet.radius;

describe("composeMatrix", () => {
  // Instances must land exactly where the <group>/<mesh> they replaced did.
  test("composes position, rotation and scale the way three's own objects do", () => {
    const object = new Object3D();
    object.position.set(1.5, -2, 0.25);
    object.rotation.set(0.3, -1.1, 0.7);
    object.scale.set(2, 0.5, 1.25);
    object.updateMatrix();

    const matrix = composeMatrix(
      [1.5, -2, 0.25],
      [0.3, -1.1, 0.7],
      [2, 0.5, 1.25],
    );
    expect(matrix.equals(object.matrix)).toBe(true);
  });
});

describe("batchInstances", () => {
  test("groups copies by mesh, material and shadow flags, keeping every copy", () => {
    const box = new BoxGeometry();
    const red = new MeshBasicMaterial();
    const blue = new MeshBasicMaterial();
    const at = (
      x: number,
      material = red,
      castShadow = true,
    ): PropInstance => ({
      geometry: box,
      material,
      matrix: new Matrix4().makeTranslation(x, 0, 0),
      castShadow,
      receiveShadow: false,
    });
    const batches = batchInstances([
      at(1),
      at(2, blue),
      at(3),
      at(4, red, false),
    ]);

    expect(batches).toHaveLength(3);
    expect(batches[0].matrices.map((m) => m.elements[12])).toEqual([1, 3]);
    expect(batches.reduce((n, b) => n + b.matrices.length, 0)).toBe(4);
  });
});

describe("the planet's static props", () => {
  const instances = [
    ...bushInstances(scatterBushes(150, R, center)),
    ...desertInstances(scatterDesertFeatures(70, R, center), R),
    ...archInstances(placeRockArches(R, center), R),
    ...forestRockInstances(scatterForestRocks(24, R, center), R),
    ...ridgeInstances(ridgeChains(R, center)),
    ...snowPropInstances(scatterSnowProps(70, R, center), R),
  ];

  // The point of instancing: these were each their own mesh - their own
  // draw call, twice with shadows - and are now a few dozen draws in all.
  test("well over a thousand copies draw as a few dozen batches", () => {
    expect(instances.length).toBeGreaterThan(1000);
    expect(batchInstances(instances).length).toBeLessThan(40);
  });

  test("each geology part lands exactly where its layout puts it", () => {
    for (const feature of scatterDesertFeatures(70, R, center).slice(0, 12)) {
      const layout = desertFeatureLayout(feature.seed, R);
      const placed = geologyInstances(feature, layout, "desert");
      expect(placed).toHaveLength(layout.parts.length);
      const facing = propQuaternion(layout, feature.normal, feature.seed);

      layout.parts.forEach((part, i) => {
        // A corner of the unit mesh, through the part and then the prop.
        const corner = new Vector3(0.7, 0.4, -0.5);
        const expected = corner
          .clone()
          .multiply(new Vector3(...part.scale))
          .applyQuaternion(part.quaternion)
          .add(new Vector3(...part.position))
          .applyQuaternion(facing)
          .add(feature.position);
        const actual = corner.clone().applyMatrix4(placed[i].matrix);
        expect(actual.distanceTo(expected)).toBeLessThan(1e-9);
      });
    }
  });
});
