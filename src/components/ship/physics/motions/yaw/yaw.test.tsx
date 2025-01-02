import { Group } from "three";
import { YawMotion } from "./yaw";
import { describe, test, expect } from "vitest";

describe("YawMotion class tests", () => {
  test("attaches to a group and updates rotation based on active keys", async () => {
    const group = new Group();
    const motion = new YawMotion({
      axis: "y",
      positiveKey: "ArrowRight",
      negativeKey: "ArrowLeft",
      rateIncrement: 0.1,
      maxRate: 1,
      decayFactor: 0.95,
    });

    motion.attachTo(group);

    // Simulate active keys using a Set
    const activeKeys = new Set<string>();

    // Add "ArrowUp" to the active keys and update
    activeKeys.add("ArrowRight");
    motion.update(0.016, activeKeys); // Simulate 16ms frame update

    // Allow the spring to update over time
    await new Promise((resolve) => setTimeout(resolve, 100)); // Adjust timing as needed

    // Check that the rotation is not 0
    expect(group.rotation.y).not.toBe(0);

    // Optionally, ensure it's moving in the positive direction
    expect(group.rotation.y).toBeGreaterThan(0);
  });
});
