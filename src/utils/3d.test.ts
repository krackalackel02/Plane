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
  // The mat is placed by the layout in its own right now (on the trail, on
  // the planet's surface) rather than derived from a fixed offset in the
  // board's frame - so this simply reads it back, as a fresh vector.
  test("returns the board's own mat position", () => {
    const result = getBoardMatWorldPosition({ matPosition: [1, 2, 3] });
    expect(result.toArray()).toEqual([1, 2, 3]);
  });

  test("returns a new vector each call, safe to mutate", () => {
    const board = { matPosition: [4, 5, 6] as [number, number, number] };
    getBoardMatWorldPosition(board).set(0, 0, 0);
    expect(getBoardMatWorldPosition(board).toArray()).toEqual([4, 5, 6]);
  });
});
