import { describe, test, expect } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
  alignOrientationToNormal,
  angleBetween,
  buildSurfaceOrientation,
  eastNorthAt,
  forwardOf,
  pointOnSphere,
  projectToShell,
  slerpOnSphere,
  surfaceNormal,
  upOf,
} from "./planetSurface";

describe("pointOnSphere / surfaceNormal", () => {
  test("lon 0, lat 0 sits on +Z at the given radius", () => {
    const p = pointOnSphere(10, 0, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(10);
  });

  test("lat pi/2 sits at the north pole regardless of longitude", () => {
    const p = pointOnSphere(10, Math.PI / 2, 1.23);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(10, 5);
    expect(p.z).toBeCloseTo(0, 5);
  });

  test("surfaceNormal is unit length and points radially outward", () => {
    const center = new Vector3(5, 0, 0);
    const p = pointOnSphere(10, 0.3, 1.1, center);
    const normal = surfaceNormal(p, center);
    expect(normal.length()).toBeCloseTo(1);
    expect(p.clone().sub(center).normalize().distanceTo(normal)).toBeCloseTo(0);
  });
});

describe("projectToShell", () => {
  test("re-projects an arbitrary point onto the given radius, preserving direction", () => {
    const p = new Vector3(3, 4, 0); // length 5
    const projected = projectToShell(p, 10);
    expect(projected.length()).toBeCloseTo(10);
    expect(
      projected.clone().normalize().distanceTo(p.clone().normalize()),
    ).toBeCloseTo(0);
  });
});

describe("buildSurfaceOrientation", () => {
  test("local +Y matches the given up vector", () => {
    const up = new Vector3(1, 1, 1).normalize();
    const q = buildSurfaceOrientation(up, new Vector3(0, 0, 1));
    expect(upOf(q).distanceTo(up)).toBeLessThan(1e-5);
  });

  test("falls back to a well-defined basis when forwardHint is parallel to up", () => {
    const up = new Vector3(0, 1, 0);
    const q = buildSurfaceOrientation(up, new Vector3(0, 1, 0));
    expect(upOf(q).distanceTo(up)).toBeLessThan(1e-5);
    expect(Number.isFinite(forwardOf(q).x)).toBe(true);
  });
});

describe("alignOrientationToNormal", () => {
  test("carries local up onto the new normal", () => {
    const start = new Quaternion(); // identity: up = +Y
    const newNormal = new Vector3(1, 0, 0);
    const aligned = alignOrientationToNormal(start, newNormal);
    expect(upOf(aligned).distanceTo(newNormal)).toBeLessThan(1e-5);
  });

  test("preserves forward as closely as the new surface allows", () => {
    // Facing +Z, up +Y. Re-aligning up to +Y (unchanged) should leave
    // forward untouched entirely.
    const q = new Quaternion();
    const aligned = alignOrientationToNormal(q, new Vector3(0, 1, 0));
    expect(forwardOf(aligned).distanceTo(new Vector3(0, 0, 1))).toBeLessThan(
      1e-5,
    );
  });
});

describe("eastNorthAt", () => {
  test("east and north are unit, mutually perpendicular, and perpendicular to the normal", () => {
    const normal = new Vector3(0.3, 0.5, 0.8).normalize();
    const { east, north } = eastNorthAt(normal);
    expect(east.length()).toBeCloseTo(1);
    expect(north.length()).toBeCloseTo(1);
    expect(east.dot(normal)).toBeCloseTo(0, 5);
    expect(north.dot(normal)).toBeCloseTo(0, 5);
    expect(east.dot(north)).toBeCloseTo(0, 5);
  });

  test("at the equator, east matches the direction of increasing longitude", () => {
    const lon = 0.7;
    const normal = pointOnSphere(1, 0, lon);
    const { east } = eastNorthAt(normal);
    const dLon = pointOnSphere(1, 0, lon + 0.001).sub(pointOnSphere(1, 0, lon));
    expect(east.dot(dLon.normalize())).toBeGreaterThan(0.999);
  });
});

describe("angleBetween / slerpOnSphere", () => {
  test("angleBetween is 0 for identical directions and pi/2 for perpendicular ones", () => {
    expect(
      angleBetween(new Vector3(1, 0, 0), new Vector3(1, 0, 0)),
    ).toBeCloseTo(0);
    expect(
      angleBetween(new Vector3(1, 0, 0), new Vector3(0, 1, 0)),
    ).toBeCloseTo(Math.PI / 2);
  });

  test("slerpOnSphere interpolates along the great circle, staying unit length throughout", () => {
    const a = new Vector3(1, 0, 0);
    const b = new Vector3(0, 0, 1);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const p = slerpOnSphere(a, b, t);
      expect(p.length()).toBeCloseTo(1);
    }
    expect(slerpOnSphere(a, b, 0).distanceTo(a)).toBeCloseTo(0);
    expect(slerpOnSphere(a, b, 1).distanceTo(b)).toBeCloseTo(0);
  });
});
