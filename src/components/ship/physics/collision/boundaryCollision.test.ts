import { describe, test, expect } from "vitest";
import { clampToBounds } from "./boundaryCollision";

describe("clampToBounds", () => {
  const bounds = { minX: -50, maxX: 50, minZ: -30, maxZ: 30 };

  test("leaves a position inside the bounds untouched", () => {
    const result = clampToBounds({ x: 10, z: -5 }, bounds);
    expect(result).toEqual({ position: { x: 10, z: -5 }, hitX: 0, hitZ: 0 });
  });

  test("clamps to the min side and reports it", () => {
    const result = clampToBounds({ x: -80, z: 0 }, bounds);
    expect(result.position.x).toBe(bounds.minX);
    expect(result.hitX).toBe(-1);
    expect(result.hitZ).toBe(0);
  });

  test("clamps to the max side and reports it", () => {
    const result = clampToBounds({ x: 0, z: 90 }, bounds);
    expect(result.position.z).toBe(bounds.maxZ);
    expect(result.hitZ).toBe(1);
    expect(result.hitX).toBe(0);
  });

  test("clamps both axes independently at a corner", () => {
    const result = clampToBounds({ x: -100, z: 100 }, bounds);
    expect(result.position).toEqual({ x: bounds.minX, z: bounds.maxZ });
    expect(result.hitX).toBe(-1);
    expect(result.hitZ).toBe(1);
  });
});
