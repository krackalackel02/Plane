import { Group, Vector3 } from "three";
import { describe, test, expect, beforeEach } from "vitest";
import { AutopilotMotion } from "./autopilot";
import type { BoardObb } from "../../collision/boardCollision";

describe("AutopilotMotion", () => {
  let group: Group;
  let motion: AutopilotMotion;

  beforeEach(() => {
    group = new Group();
    motion = new AutopilotMotion();
    motion.attachTo(group);
  });

  test("flies directly to the target when already inside the board shell", () => {
    const from = new Vector3(5, 0, 5); // well inside a radius of 40
    const to = new Vector3(30, 0, 20);
    motion.start(from, to, 40, [], 12);

    // A big single step should still land short of arrival, but moving
    // toward the target rather than detouring through the origin first.
    const status = motion.update(0.1, false);
    expect(status).toBe("flying");
    expect(group.position.distanceTo(to)).toBeLessThan(from.distanceTo(to));
  });

  test("detours via the origin when starting outside the board shell", () => {
    const from = new Vector3(0, 0, 50); // outside a radius of 40
    const to = new Vector3(30, 0, 5);
    motion.start(from, to, 40, [], 12);

    // Early in the flight, a detoured path should be closer to the origin
    // waypoint than a direct path would ever bring it.
    motion.update(0.05, false);
    const distanceFromOrigin = group.position.length();
    expect(distanceFromOrigin).toBeLessThan(
      from.distanceTo(new Vector3(0, 0, 0)),
    );
  });

  test("reaches the exact target position on arrival", () => {
    const from = new Vector3(5, 0, 5);
    const to = new Vector3(20, 0, 10);
    motion.start(from, to, 40, [], 1000); // fast speed so it arrives quickly

    let status;
    for (let i = 0; i < 20 && status !== "arrived"; i++) {
      status = motion.update(0.5, false);
    }

    expect(status).toBe("arrived");
    expect(group.position.x).toBeCloseTo(to.x, 3);
    expect(group.position.y).toBeCloseTo(to.y, 3);
    expect(group.position.z).toBeCloseTo(to.z, 3);
  });

  test("cancels immediately when manual input is present", () => {
    const from = new Vector3(0, 0, 0);
    const to = new Vector3(20, 0, 10);
    motion.start(from, to, 40, []);

    expect(motion.update(0.1, true)).toBe("cancelled");
  });

  test("cancels if update is called before attaching to a group", () => {
    const unattached = new AutopilotMotion();
    expect(unattached.update(0.1, false)).toBe("cancelled");
  });

  describe("board avoidance", () => {
    // A board sitting on the +x axis, 40 units out - its facing axis
    // (away from the origin - see boardCollision.ts) is world +x.
    const boardOnPositiveX: BoardObb = {
      centerX: 40,
      centerZ: 0,
      rotationY: 0,
      halfDepth: 0.2,
      halfWidth: 3.35,
    };

    test("routes around a board the ship is currently shadowed behind, instead of straight through it via the origin", () => {
      // Starting well past the board, lined up on its exact bearing - the
      // naive "detour via the origin" fallback would otherwise cut
      // straight through it on the way in.
      const from = new Vector3(60, 0, 0);
      const to = new Vector3(-30, 0, 20);
      motion.start(from, to, 40, [boardOnPositiveX], 1000);

      let minLateralClearance = Infinity;
      let status;
      for (let i = 0; i < 200 && status !== "arrived"; i++) {
        status = motion.update(0.02, false);
        // Only relevant while still near the board's own radius band.
        if (Math.abs(group.position.x - 40) < 5) {
          minLateralClearance = Math.min(
            minLateralClearance,
            Math.abs(group.position.z),
          );
        }
      }

      expect(status).toBe("arrived");
      // Never came closer to the board's own bearing (z=0) than its
      // lateral span while passing through that radius band.
      expect(minLateralClearance).toBeGreaterThanOrEqual(
        boardOnPositiveX.halfWidth,
      );
    });

    test("a path that never needed the origin detour is untouched by an unrelated board", () => {
      const from = new Vector3(5, 0, 5); // inside the shell, nowhere near boardOnPositiveX's bearing
      const to = new Vector3(10, 0, 20);
      motion.start(from, to, 40, [boardOnPositiveX], 12);

      const status = motion.update(0.1, false);
      expect(status).toBe("flying");
      expect(group.position.distanceTo(to)).toBeLessThan(from.distanceTo(to));
    });
  });
});
