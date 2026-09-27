import { describe, test, expect } from "vitest";
import { computeWorldBounds } from "./worldBounds";

describe("computeWorldBounds", () => {
  test("contains every board position plus the origin, with margin to spare", () => {
    const boards = [
      { position: [40, 0, 60] as [number, number, number] },
      { position: [-40, 0, 10] as [number, number, number] },
    ];
    const bounds = computeWorldBounds(boards, 45);

    expect(bounds.minX).toBeLessThan(-40);
    expect(bounds.maxX).toBeGreaterThan(40);
    expect(bounds.minZ).toBeLessThan(0); // origin (z=0) included
    expect(bounds.maxZ).toBeGreaterThan(60);
  });

  test("floors the span so a single board (or none) doesn't shrink the zone to a point", () => {
    const bounds = computeWorldBounds([{ position: [0, 0, 0] }], 45);

    expect(bounds.maxX - bounds.minX).toBeGreaterThanOrEqual(60 + 90 - 1);
    expect(bounds.maxZ - bounds.minZ).toBeGreaterThanOrEqual(60 + 90 - 1);
  });

  test("is centered on the boards' own bounding box, not just the origin", () => {
    const boards = [
      { position: [100, 0, 0] as [number, number, number] },
      { position: [120, 0, 0] as [number, number, number] },
    ];
    const bounds = computeWorldBounds(boards, 0);
    const centerX = (bounds.minX + bounds.maxX) / 2;

    // Center of [0, 100, 120] span is 60, not the boards' own midpoint
    // (110) - the ship's origin is always part of the play area too.
    expect(centerX).toBeCloseTo(60);
  });
});
