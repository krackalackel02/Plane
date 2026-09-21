import { describe, test, expect } from "vitest";
import { lerpAngle, getBoardMatWorldPosition } from "./3d";

describe("lerpAngle", () => {
  test("interpolates linearly for a small delta", () => {
    expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 5);
  });

  test("takes the shortest path across the +-PI boundary", () => {
    // From just past +PI to just past -PI is a tiny step the "short way",
    // not the long way around through 0.
    const from = Math.PI - 0.1;
    const to = -Math.PI + 0.1;
    const result = lerpAngle(from, to, 1);
    // Normalize into (-PI, PI] for comparison.
    const normalized = Math.atan2(Math.sin(result), Math.cos(result));
    expect(normalized).toBeCloseTo(to, 5);
  });

  test("t=0 returns the starting angle unchanged", () => {
    expect(lerpAngle(1.23, 4.56, 0)).toBeCloseTo(1.23, 5);
  });
});

describe("getBoardMatWorldPosition", () => {
  test("applies the local offset unrotated when board rotation is 0", () => {
    const result = getBoardMatWorldPosition([10, 0, 10], 0);
    expect(result.x).toBeCloseTo(5, 5); // 10 + (-5)
    expect(result.y).toBeCloseTo(-2.5, 5); // 0 + (-2.5), unaffected by Y rotation
    expect(result.z).toBeCloseTo(10, 5); // 10 + 0
  });

  test("Y rotation only mixes x/z, never y", () => {
    const result = getBoardMatWorldPosition([0, 3, 0], Math.PI / 2);
    expect(result.y).toBeCloseTo(0.5, 5); // 3 + (-2.5), independent of rotation
  });
});
