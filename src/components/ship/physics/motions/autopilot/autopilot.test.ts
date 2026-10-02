import { Vector3 } from "three";
import { describe, test, expect, beforeEach } from "vitest";
import { AutopilotMotion } from "./autopilot";
import { Planet } from "../../../../../utils/planets";

// A radius-1 planet keeps the arithmetic simple; every test's from/to
// points are already unit vectors so start() reprojects them unchanged.
const testPlanet: Planet = {
  id: "test",
  center: new Vector3(0, 0, 0),
  radius: 1,
  shipAltitude: 0,
};

describe("AutopilotMotion", () => {
  let motion: AutopilotMotion;

  beforeEach(() => {
    motion = new AutopilotMotion();
  });

  test("flies along the great circle toward the target", () => {
    const from = new Vector3(1, 0, 0);
    const to = new Vector3(0, 0, 1);
    motion.start(from, to, 12, testPlanet);

    const result = motion.update(0.1, false);
    expect(result.status).toBe("flying");
    expect(result.position.distanceTo(to)).toBeLessThan(from.distanceTo(to));
    // Every point along the arc stays on the shell - this is the whole
    // point of slerping instead of lerping: it can never dip inside the
    // planet.
    expect(result.position.length()).toBeCloseTo(1, 5);
  });

  test("reaches the exact target position on arrival", () => {
    const from = new Vector3(1, 0, 0);
    const to = new Vector3(0, 1, 0);
    motion.start(from, to, 1000, testPlanet); // fast speed so it arrives quickly

    let result;
    for (let i = 0; i < 20 && result?.status !== "arrived"; i++) {
      result = motion.update(0.5, false);
    }

    expect(result?.status).toBe("arrived");
    expect(result?.position.x).toBeCloseTo(to.x, 3);
    expect(result?.position.y).toBeCloseTo(to.y, 3);
    expect(result?.position.z).toBeCloseTo(to.z, 3);
  });

  test("cancels immediately when manual input is present, holding position", () => {
    const from = new Vector3(1, 0, 0);
    const to = new Vector3(0, 0, 1);
    motion.start(from, to, 12, testPlanet);

    const result = motion.update(0.1, true);
    expect(result.status).toBe("cancelled");
    expect(result.position.distanceTo(from)).toBeCloseTo(0, 5);
  });

  test("cancels if update is called before start()", () => {
    const fresh = new AutopilotMotion();
    expect(fresh.update(0.1, false).status).toBe("cancelled");
  });

  test("a widely separated start/end never dips below the shell radius mid-flight", () => {
    // Nearly opposite sides of the planet (just short of the antipode,
    // where the great-circle direction is undefined) - the straight
    // Euclidean line between them would pass through the core; the
    // great-circle arc must not.
    const from = new Vector3(1, 0, 0);
    const to = new Vector3(-1, 0, 0.05).normalize();
    motion.start(from, to, 4, testPlanet);

    for (let i = 0; i < 10; i++) {
      const result = motion.update(0.05, false);
      expect(result.position.length()).toBeCloseTo(1, 5);
    }
  });
});
