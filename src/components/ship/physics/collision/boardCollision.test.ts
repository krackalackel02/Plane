import { describe, test, expect } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
  buildBoardObbs,
  resolveShipBoardCollision,
  type BoardObb,
} from "./boardCollision";

const identity: [number, number, number, number] = [0, 0, 0, 1];
// A small, simple ship box - easy to reason about penetration depths
// without it dominating the numbers in every test.
const shipHalf = { x: 0.5, y: 0.5, z: 0.5 };

describe("buildBoardObbs", () => {
  test("swaps outerZ/outerX onto depth/width per the board's baked -90deg rotation", () => {
    const [obb] = buildBoardObbs(
      [{ position: [10, 0, -3], quaternion: identity }],
      { outerX: 6.7, outerY: 4.4, outerZ: 0.4 },
    );

    expect(obb.position.x).toBe(10);
    expect(obb.position.z).toBe(-3);
    expect(obb.halfExtents.x).toBeCloseTo(0.2);
    expect(obb.halfExtents.y).toBeCloseTo(2.2);
    expect(obb.halfExtents.z).toBeCloseTo(3.35);
  });
});

describe("resolveShipBoardCollision", () => {
  const obb: BoardObb = {
    position: new Vector3(0, 0, 0),
    quaternion: new Quaternion(),
    invQuaternion: new Quaternion(),
    halfExtents: { x: 0.2, y: 2.2, z: 3.35 },
  };

  test("no collision when far away", () => {
    const hit = resolveShipBoardCollision(
      new Vector3(100, 0, 100),
      new Quaternion(),
      shipHalf,
      obb,
    );
    expect(hit).toBeNull();
  });

  test("pushes straight out along the facing (local X) axis when centered on an unrotated board", () => {
    const hit = resolveShipBoardCollision(
      new Vector3(0, 0, 0),
      new Quaternion(),
      shipHalf,
      obb,
    );
    expect(hit).not.toBeNull();
    // halfExtents.x (0.2) + ship's half (0.5) is far smaller than
    // halfExtents.z (3.35) + ship's half, so the nearer edge - and thus the
    // push/bounce direction - is along the facing axis, not lateral.
    expect(hit!.normal.x).toBeCloseTo(1);
    expect(hit!.normal.z).toBeCloseTo(0);
    expect(hit!.pushOut.x).toBeCloseTo(obb.halfExtents.x + shipHalf.x);
    expect(hit!.pushOut.z).toBeCloseTo(0);
  });

  test("a 90deg-rotated board's facing axis points along world -z", () => {
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI / 2,
    );
    const rotated: BoardObb = {
      ...obb,
      quaternion: q,
      invQuaternion: q.clone().invert(),
    };
    const hit = resolveShipBoardCollision(
      new Vector3(0, 0, 0),
      new Quaternion(),
      shipHalf,
      rotated,
    );
    expect(hit).not.toBeNull();
    expect(hit!.normal.x).toBeCloseTo(0);
    expect(hit!.normal.z).toBeCloseTo(-1);
  });

  test("clearing the expanded box laterally (past the board's edge) has no collision", () => {
    const hit = resolveShipBoardCollision(
      new Vector3(0, 0, obb.halfExtents.z + shipHalf.z + 0.5),
      new Quaternion(),
      shipHalf,
      obb,
    );
    expect(hit).toBeNull();
  });

  // Regression test: this is the actual bug being fixed - a ship on the far
  // side of the planet from a board can land almost exactly on top of it in
  // a flat (depth, width) footprint check, because "opposite side of a
  // sphere" is entirely a difference along the board's own height/normal
  // axis. Checking that third axis is what tells them apart.
  test("a ship far along the board's own height axis does not collide, even with matching depth/width", () => {
    const hit = resolveShipBoardCollision(
      new Vector3(0, 85, 0), // e.g. roughly the diameter of a small planet
      new Quaternion(),
      shipHalf,
      obb,
    );
    expect(hit).toBeNull();
  });

  test("works in an arbitrary orientation, not just axis-aligned", () => {
    // A board tipped 90deg so its local X (facing) now points along world Y -
    // e.g. a board standing at a planet's pole, tilted relative to a board
    // on the equator.
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      Math.PI / 2,
    );
    const tilted: BoardObb = {
      ...obb,
      position: new Vector3(5, 5, 5),
      quaternion: q,
      invQuaternion: q.clone().invert(),
    };
    const hit = resolveShipBoardCollision(
      new Vector3(5, 5, 5),
      new Quaternion(),
      shipHalf,
      tilted,
    );
    expect(hit).not.toBeNull();
    // The facing axis (local X) is now world +Y.
    expect(hit!.normal.y).toBeCloseTo(1);
  });

  test("a wide ship pokes further into the board's expanded footprint than a narrow one", () => {
    const narrowHit = resolveShipBoardCollision(
      new Vector3(0, 0, obb.halfExtents.z + 0.3),
      new Quaternion(),
      { x: 0.1, y: 0.1, z: 0.1 },
      obb,
    );
    const wideHit = resolveShipBoardCollision(
      new Vector3(0, 0, obb.halfExtents.z + 0.3),
      new Quaternion(),
      { x: 0.1, y: 0.1, z: 2 },
      obb,
    );
    expect(narrowHit).toBeNull();
    expect(wideHit).not.toBeNull();
  });
});
