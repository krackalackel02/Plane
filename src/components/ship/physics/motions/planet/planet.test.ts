import { Group, Vector3 } from "three";
import { describe, test, expect, beforeEach } from "vitest";
import { PlanetMotion, PlanetMotionConfig } from "./planet";
import { Planet } from "../../../../../utils/planets";

const testPlanet: Planet = {
  id: "test",
  center: new Vector3(0, 0, 0),
  radius: 10,
  shipAltitude: 0,
};

const config: PlanetMotionConfig = {
  yaw: { acceleration: 1, maxSpeed: 2, decayFactor: 0.9 },
  throttle: { acceleration: 1, maxSpeed: 2, decayFactor: 0.9 },
};

describe("PlanetMotion", () => {
  let group: Group;
  let motion: PlanetMotion;

  beforeEach(() => {
    group = new Group();
    // Spawn on the shell, facing +Z (the ship's forward convention).
    group.position.set(0, 0, testPlanet.radius);
    motion = new PlanetMotion(
      config,
      { positive: "w", negative: "s" },
      { positive: "w", negative: "s" },
      testPlanet,
    );
  });

  test("throttle moves the ship forward and keeps it on the shell", () => {
    motion.attachTo(group);
    const activeKeys = new Set(["w"]);

    let result;
    for (let i = 0; i < 10; i++) {
      result = motion.update(0.1, activeKeys, group.position);
      group.position.copy(result.position);
    }

    expect(result!.position.length()).toBeCloseTo(testPlanet.radius, 5);
    // Started at (0,0,radius) moving toward +Z (its own forward) - it should
    // have travelled away from its starting point.
    expect(
      result!.position.distanceTo(new Vector3(0, 0, testPlanet.radius)),
    ).toBeGreaterThan(0);
  });

  test("yaw turns the ship around its own local up without moving it", () => {
    const yawMotion = new PlanetMotion(
      config,
      { positive: "a", negative: "d" },
      { positive: "w", negative: "s" },
      testPlanet,
    );
    yawMotion.attachTo(group);
    const activeKeys = new Set(["a"]);

    let result;
    for (let i = 0; i < 10; i++) {
      result = yawMotion.update(0.1, activeKeys, group.position);
      group.position.copy(result.position);
    }

    // Position barely changes (pure rotation in place); orientation does.
    expect(
      result!.position.distanceTo(new Vector3(0, 0, testPlanet.radius)),
    ).toBeLessThan(0.01);
    const forward = new Vector3(0, 0, 1).applyQuaternion(result!.orientation);
    expect(forward.distanceTo(new Vector3(0, 0, 1))).toBeGreaterThan(0.01);
  });

  test("re-syncs from the caller's currentPosition each call, so an external correction sticks", () => {
    motion.attachTo(group);
    motion.update(0.1, new Set(["w"]), group.position);

    // Something else (e.g. board-bounce collision) nudges the ship after
    // Physics wrote this frame's transform.
    const corrected = new Vector3(testPlanet.radius, 0, 0);
    const result = motion.update(0.1, new Set(), corrected);

    // With no throttle held, speed decays toward 0 but the position this
    // frame is still based on the corrected point, not the pre-correction one.
    expect(
      result.position
        .clone()
        .normalize()
        .distanceTo(new Vector3(1, 0, 0)),
    ).toBeLessThan(0.1);
  });

  test("decays speed back to zero once throttle is released", () => {
    motion.attachTo(group);
    motion.update(0.1, new Set(["w"]), group.position);
    let result = motion.update(0.1, new Set(["w"]), group.position);
    const movingPosition = result.position.clone();

    for (let i = 0; i < 50; i++) {
      result = motion.update(0.1, new Set(), result.position);
    }

    // Once decayed to a stop, further updates barely move it.
    const before = result.position.clone();
    result = motion.update(0.1, new Set(), result.position);
    expect(result.position.distanceTo(before)).toBeLessThan(1e-3);
    expect(movingPosition.distanceTo(before)).toBeGreaterThan(0);
  });
});
