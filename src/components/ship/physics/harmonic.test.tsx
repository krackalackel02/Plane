import { Group } from "three";
import { HarmonicMotion } from "./harmonic";
import { describe, test, expect } from "vitest";

describe("HarmonicMotion class tests", () => {
  test("attaches to a group and updates rotation based on active keys", async () => {
    const group = new Group();
    const motion = new HarmonicMotion({
      axis: "x",
      stiffness: 50,
      damping: 4,
      maxAngle: Math.PI / 12,
      positiveKey: "ArrowUp",
      negativeKey: "ArrowDown",
    });

    motion.attachTo(group);

    // Simulate active keys using a Set
    const activeKeys = new Set<string>();

    // Add "ArrowUp" to the active keys and update
    activeKeys.add("ArrowUp");
    motion.update(0.016, activeKeys); // Simulate 16ms frame update

    // Allow the spring to update over time
    await new Promise((resolve) => setTimeout(resolve, 100)); // Adjust timing as needed

    // Check that the rotation is not 0
    expect(group.rotation.x).not.toBe(0);

    // Optionally, ensure it's moving in the positive direction
    expect(group.rotation.x).toBeGreaterThan(0);
  });
});
