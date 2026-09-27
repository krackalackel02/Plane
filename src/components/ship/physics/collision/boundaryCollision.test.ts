import { describe, test, expect } from "vitest";
import { clampToBounds } from "./boundaryCollision";

describe("clampToBounds", () => {
  const bounds = { centerX: 0, centerZ: 0, radius: 50 };

  test("leaves a position inside the radius untouched", () => {
    const result = clampToBounds({ x: 10, z: -5 }, bounds);
    expect(result).toEqual({
      position: { x: 10, z: -5 },
      hit: false,
      outwardNormal: { x: 0, z: 0 },
    });
  });

  test("a position exactly on the radius is not clamped", () => {
    const result = clampToBounds({ x: 50, z: 0 }, bounds);
    expect(result.hit).toBe(false);
  });

  test("clamps a position beyond the radius back onto the circle, reporting the outward normal", () => {
    const result = clampToBounds({ x: 100, z: 0 }, bounds);
    expect(result.hit).toBe(true);
    expect(result.position.x).toBeCloseTo(50);
    expect(result.position.z).toBeCloseTo(0);
    expect(result.outwardNormal).toEqual({ x: 1, z: 0 });
  });

  test("clamps along an arbitrary direction, keeping the position on the circle", () => {
    const result = clampToBounds({ x: 60, z: 80 }, bounds); // distance 100
    expect(result.hit).toBe(true);
    // Clamped point should be exactly `radius` from center.
    expect(Math.hypot(result.position.x, result.position.z)).toBeCloseTo(50);
    expect(result.outwardNormal.x).toBeCloseTo(0.6);
    expect(result.outwardNormal.z).toBeCloseTo(0.8);
  });

  test("works off-center", () => {
    const offCenter = { centerX: 10, centerZ: 10, radius: 20 };
    const result = clampToBounds({ x: 40, z: 10 }, offCenter);
    expect(result.hit).toBe(true);
    expect(result.position.x).toBeCloseTo(30);
    expect(result.position.z).toBeCloseTo(10);
  });
});
