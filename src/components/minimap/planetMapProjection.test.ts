import { describe, test, expect } from "vitest";
import { Vector3 } from "three";
import { buildSurfaceOrientation } from "../../utils/planetSurface";
import {
  computeAzimuthalProjection,
  headingBearing,
} from "./planetMapProjection";

const SIZE = 200;
const R = 10;

describe("computeAzimuthalProjection", () => {
  test("the center position itself maps to the middle of the map", () => {
    const shipPosition = new Vector3(0, 0, R); // lon 0, on the equator
    const { toMap } = computeAzimuthalProjection(shipPosition, SIZE);
    const [x, y] = toMap(shipPosition);
    expect(x).toBeCloseTo(SIZE / 2, 4);
    expect(y).toBeCloseTo(SIZE / 2, 4);
  });

  test("the exact antipodal point lands on the outer rim - the whole sphere always fits", () => {
    const shipPosition = new Vector3(0, 0, R);
    const { toMap } = computeAzimuthalProjection(shipPosition, SIZE);
    const [x, y] = toMap(new Vector3(0, 0, -R));
    const distanceFromCenter = Math.hypot(x - SIZE / 2, y - SIZE / 2);
    expect(distanceFromCenter).toBeCloseTo(SIZE / 2, 4);
  });

  test("a point a quarter of the way around lands exactly halfway out - distance from center is proportional to true angular distance", () => {
    const shipPosition = new Vector3(0, 0, R);
    const { toMap } = computeAzimuthalProjection(shipPosition, SIZE);
    const [x, y] = toMap(new Vector3(R, 0, 0)); // 90 degrees away
    const distanceFromCenter = Math.hypot(x - SIZE / 2, y - SIZE / 2);
    expect(distanceFromCenter).toBeCloseTo(SIZE / 4, 4);
  });

  test("north of the ship maps straight up (smaller y) on the map", () => {
    const shipPosition = new Vector3(0, 0, R); // lon 0, on the equator
    const { toMap } = computeAzimuthalProjection(shipPosition, SIZE);
    // North at lon 0 is toward +Y (see eastNorthAt / buildSurfaceOrientation).
    const [x, y] = toMap(new Vector3(0, 1, R).normalize().multiplyScalar(R));
    expect(x).toBeCloseTo(SIZE / 2, 1);
    expect(y).toBeLessThan(SIZE / 2);
  });

  test("east of the ship maps to the right (larger x) on the map", () => {
    const shipPosition = new Vector3(0, 0, R); // lon 0, on the equator
    const { toMap } = computeAzimuthalProjection(shipPosition, SIZE);
    // East at lon 0 is toward +X (see eastNorthAt).
    const [x, y] = toMap(new Vector3(1, 0, R).normalize().multiplyScalar(R));
    expect(x).toBeGreaterThan(SIZE / 2);
    expect(y).toBeCloseTo(SIZE / 2, 1);
  });

  test("re-centers as the ship moves - the same world point maps differently from a different center", () => {
    const target = new Vector3(0, 0, -R); // lon pi
    const fromLonZero = computeAzimuthalProjection(
      new Vector3(0, 0, R),
      SIZE,
    ).toMap(target);
    const fromLonQuarter = computeAzimuthalProjection(
      new Vector3(R, 0, 0),
      SIZE,
    ).toMap(target);
    expect(fromLonZero).not.toEqual(fromLonQuarter);
  });
});

describe("headingBearing", () => {
  test("facing north (toward the pole) at the equator gives a bearing of 0", () => {
    const position = new Vector3(0, 0, 10); // lon 0, on the equator
    const normal = position.clone().normalize();
    // North at lon 0 is toward +Y (see eastNorthAt / buildSurfaceOrientation).
    const orientation = buildSurfaceOrientation(normal, new Vector3(0, 1, 0));
    const bearing = headingBearing(orientation, position);
    expect(bearing).toBeCloseTo(0, 4);
  });

  test("facing east gives a bearing of +pi/2 (compass convention)", () => {
    const position = new Vector3(0, 0, 10); // lon 0
    const normal = position.clone().normalize();
    const east = new Vector3(1, 0, 0); // east at lon 0 is +X
    const orientation = buildSurfaceOrientation(normal, east);
    const bearing = headingBearing(orientation, position);
    expect(bearing).toBeCloseTo(Math.PI / 2, 4);
  });

  test("holds at an arbitrary longitude too, not just lon 0", () => {
    const position = new Vector3(10, 0, 0); // lon pi/2
    const normal = position.clone().normalize();
    const east = new Vector3(0, 0, -1); // east at lon pi/2 (see eastNorthAt)
    const orientation = buildSurfaceOrientation(normal, east);
    const bearing = headingBearing(orientation, position);
    expect(bearing).toBeCloseTo(Math.PI / 2, 4);
  });
});
