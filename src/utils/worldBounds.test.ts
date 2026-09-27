import { describe, test, expect } from "vitest";
import { computeWorldBounds } from "./worldBounds";

describe("computeWorldBounds", () => {
  test("is centered on the origin, with radius reaching past the farthest board", () => {
    const boards = [
      { position: [40, 0, 60] as [number, number, number] },
      { position: [-40, 0, 10] as [number, number, number] },
    ];
    const bounds = computeWorldBounds(boards, 45);
    const farthest = Math.hypot(40, 60);

    expect(bounds.centerX).toBe(0);
    expect(bounds.centerZ).toBe(0);
    expect(bounds.radius).toBeCloseTo(farthest + 45);
  });

  test("floors the radius so a single board (or none) doesn't shrink the zone to a point", () => {
    const bounds = computeWorldBounds([{ position: [0, 0, 0] }], 45);

    expect(bounds.radius).toBeGreaterThanOrEqual(60);
  });

  test("every board lies within the radius", () => {
    const boards = [
      { position: [100, 0, 0] as [number, number, number] },
      { position: [-30, 0, 120] as [number, number, number] },
    ];
    const bounds = computeWorldBounds(boards);

    boards.forEach((b) => {
      const dist = Math.hypot(b.position[0] - bounds.centerX, b.position[2] - bounds.centerZ);
      expect(dist).toBeLessThan(bounds.radius);
    });
  });
});
