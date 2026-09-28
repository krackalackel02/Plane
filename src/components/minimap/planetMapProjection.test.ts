import { describe, test, expect } from "vitest";
import { Vector3 } from "three";
import { buildSurfaceOrientation } from "../../utils/planetSurface";
import {
  computePlanetToMapProjection,
  headingBearing,
  latLonOf,
  type WorldPoint,
} from "./planetMapProjection";

const SIZE = 200;

describe("latLonOf", () => {
  test("lon 0, lat 0 is +Z", () => {
    const { lat, lon } = latLonOf(new Vector3(0, 0, 10));
    expect(lat).toBeCloseTo(0);
    expect(lon).toBeCloseTo(0);
  });

  test("the north pole has lat pi/2", () => {
    const { lat } = latLonOf(new Vector3(0, 10, 0));
    expect(lat).toBeCloseTo(Math.PI / 2);
  });
});

describe("computePlanetToMapProjection", () => {
  const boards: WorldPoint[] = [
    { id: "a", position: [0, 0, 10] }, // lon 0
    { id: "b", position: [10, 0, 0] }, // lon pi/2
  ];

  test("the whole planet always fits - a point on the far side still lands on the map", () => {
    const { toMap } = computePlanetToMapProjection(boards, SIZE);
    const [x, y] = toMap(new Vector3(0, 0, -10)); // lon pi
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(SIZE);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(SIZE);
  });

  test("the equator (lat 0) always maps to vertical center", () => {
    const { toMap } = computePlanetToMapProjection(boards, SIZE);
    const [, y] = toMap(new Vector3(0, 0, 10));
    expect(y).toBeCloseTo(SIZE / 2);
  });

  test("the north pole maps above the equator (smaller y) and the south pole below", () => {
    const { toMap } = computePlanetToMapProjection(boards, SIZE);
    const [, northY] = toMap(new Vector3(0, 10, 0));
    const [, southY] = toMap(new Vector3(0, -10, 0));
    const [, equatorY] = toMap(new Vector3(0, 0, 10));
    expect(northY).toBeLessThan(equatorY);
    expect(southY).toBeGreaterThan(equatorY);
  });

  test("increasing longitude moves right across the map", () => {
    const { toMap } = computePlanetToMapProjection(boards, SIZE);
    const [xAtZeroLon] = toMap(new Vector3(0, 0, 10)); // lon 0
    const [xAtQuarterLon] = toMap(new Vector3(10, 0, 0)); // lon pi/2
    expect(xAtQuarterLon).toBeGreaterThan(xAtZeroLon);
  });

  test("boardPoints match what toMap computes for the same positions", () => {
    const { toMap, boardPoints } = computePlanetToMapProjection(boards, SIZE);
    const a = boardPoints.find((p) => p.id === "a")!;
    const [x, y] = toMap(new Vector3(0, 0, 10));
    expect(a.x).toBeCloseTo(x);
    expect(a.y).toBeCloseTo(y);
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
