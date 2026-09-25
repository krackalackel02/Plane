import { Group } from "three";
import { describe, test, expect, beforeEach } from "vitest";
import { TrickMotion } from "./trick";

describe("TrickMotion", () => {
  let group: Group;
  let motion: TrickMotion;

  beforeEach(() => {
    group = new Group();
    motion = new TrickMotion(1);
    motion.attachTo(group);
  });

  test("rolls partway through the barrel roll mid-animation", () => {
    motion.start();

    const status = motion.update(0.5);
    expect(status).toBe("playing");
    expect(group.rotation.z).toBeGreaterThan(0);
    expect(group.rotation.z).toBeLessThan(Math.PI * 2);
  });

  test("completes a full roll and resets to 0 rotation", () => {
    motion.start();

    let status;
    for (let i = 0; i < 20 && status !== "done"; i++) {
      status = motion.update(0.2);
    }

    expect(status).toBe("done");
    expect(group.rotation.z).toBe(0);
  });

  test("is done immediately if update is called before attaching to a group", () => {
    const unattached = new TrickMotion(1);
    unattached.start();
    expect(unattached.update(0.1)).toBe("done");
  });
});
