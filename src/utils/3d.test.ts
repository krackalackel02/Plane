import { describe, test, expect } from "vitest";
import { Quaternion, Vector3 } from "three";
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
  const identity: [number, number, number, number] = [0, 0, 0, 1];

  test("applies the local offset unrotated for an identity quaternion", () => {
    const result = getBoardMatWorldPosition([10, 0, 10], identity);
    expect(result.x).toBeCloseTo(5, 5); // 10 + (-5)
    expect(result.y).toBeCloseTo(-2.5, 5); // 0 + (-2.5)
    expect(result.z).toBeCloseTo(10, 5); // 10 + 0
  });

  test("a Y rotation only mixes x/z, never y", () => {
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI / 2,
    );
    const result = getBoardMatWorldPosition(
      [0, 3, 0],
      q.toArray() as [number, number, number, number],
    );
    expect(result.y).toBeCloseTo(0.5, 5); // 3 + (-2.5), independent of rotation
  });

  test("an arbitrary orientation rotates the local offset accordingly", () => {
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(1, 0, 0),
      Math.PI / 2,
    );
    const result = getBoardMatWorldPosition(
      [0, 0, 0],
      q.toArray() as [number, number, number, number],
    );
    const expected = new Vector3(-5, -2.5, 0).applyQuaternion(q);
    expect(result.x).toBeCloseTo(expected.x, 5);
    expect(result.y).toBeCloseTo(expected.y, 5);
    expect(result.z).toBeCloseTo(expected.z, 5);
  });
});
