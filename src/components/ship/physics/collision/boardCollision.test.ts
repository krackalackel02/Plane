import { describe, test, expect } from "vitest";
import {
  buildBoardObbs,
  clearBoardBearings,
  resolveCircleObb,
  type BoardObb,
} from "./boardCollision";

describe("buildBoardObbs", () => {
  test("swaps outerZ/outerX onto depth/width per the board's baked -90deg rotation", () => {
    const [obb] = buildBoardObbs(
      [{ position: [10, 0, -3], rotation: [0, Math.PI / 4, 0] }],
      { outerX: 6.7, outerZ: 0.4 },
    );

    expect(obb.centerX).toBe(10);
    expect(obb.centerZ).toBe(-3);
    expect(obb.rotationY).toBeCloseTo(Math.PI / 4);
    expect(obb.halfDepth).toBeCloseTo(0.2);
    expect(obb.halfWidth).toBeCloseTo(3.35);
  });
});

describe("resolveCircleObb", () => {
  const obb: BoardObb = {
    centerX: 0,
    centerZ: 0,
    rotationY: 0,
    halfDepth: 0.2,
    halfWidth: 3.35,
  };
  const radius = 2;

  test("no collision when far away", () => {
    expect(resolveCircleObb({ x: 100, z: 100 }, obb, radius)).toBeNull();
  });

  test("pushes straight out along the facing axis when centered on an unrotated board", () => {
    const hit = resolveCircleObb({ x: 0, z: 0 }, obb, radius);
    expect(hit).not.toBeNull();
    // halfDepth (0.2) + radius (2) is far smaller than halfWidth (3.35) +
    // radius, so the nearer edge - and thus the push/bounce direction - is
    // along the facing axis, not the lateral one.
    expect(hit!.normal.x).toBeCloseTo(1);
    expect(hit!.normal.z).toBeCloseTo(0);
    expect(hit!.pushOut.x).toBeCloseTo(obb.halfDepth + radius);
    expect(hit!.pushOut.z).toBeCloseTo(0);
  });

  test("a 90deg-rotated board's facing axis points along world -z", () => {
    const rotated: BoardObb = { ...obb, rotationY: Math.PI / 2 };
    const hit = resolveCircleObb({ x: 0, z: 0 }, rotated, radius);
    expect(hit).not.toBeNull();
    expect(hit!.normal.x).toBeCloseTo(0);
    expect(hit!.normal.z).toBeCloseTo(-1);
  });

  test("approaching face-on from a distance just inside the expanded box still collides", () => {
    // Just short of (halfDepth + radius) along the facing axis, dead
    // center laterally.
    const hit = resolveCircleObb(
      { x: obb.halfDepth + radius - 0.05, z: 0 },
      obb,
      radius,
    );
    expect(hit).not.toBeNull();
    expect(hit!.normal.x).toBeCloseTo(1);
  });

  test("clearing the expanded box laterally (past the board's edge) has no collision", () => {
    const hit = resolveCircleObb(
      { x: 0, z: obb.halfWidth + radius + 0.5 },
      obb,
      radius,
    );
    expect(hit).toBeNull();
  });
});

describe("clearBoardBearings", () => {
  // Unrotated board at the origin: its facing axis (+u, "away from the
  // origin" - see resolveCircleObb's doc comment) is world +x, its lateral
  // axis (v) is world +z.
  const obb: BoardObb = {
    centerX: 0,
    centerZ: 0,
    rotationY: 0,
    halfDepth: 0.2,
    halfWidth: 3.35,
  };
  const clearance = 3;

  test("nudges a point sideways when it's shadowed directly behind a board", () => {
    // Well past the board (u=10 >> halfDepth) and dead-center laterally
    // (v=0) - a straight line to the origin would cut right through it.
    const result = clearBoardBearings({ x: 10, z: 0 }, [obb], clearance);

    expect(result.x).toBeCloseTo(10); // "how far out" (u) is unchanged
    expect(Math.abs(result.z)).toBeGreaterThanOrEqual(obb.halfWidth + clearance);
  });

  test("leaves a point on the origin side of the board untouched", () => {
    const point = { x: -10, z: 0 };
    expect(clearBoardBearings(point, [obb], clearance)).toEqual(point);
  });

  test("leaves a point already clear of the board's lateral span untouched", () => {
    const point = { x: 10, z: obb.halfWidth + clearance + 5 };
    expect(clearBoardBearings(point, [obb], clearance)).toEqual(point);
  });

  test("leaves a point untouched when there are no boards to check", () => {
    const point = { x: 10, z: 0 };
    expect(clearBoardBearings(point, [], clearance)).toEqual(point);
  });
});
