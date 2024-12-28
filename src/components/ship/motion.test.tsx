import { Group } from "three";
import { HarmonicMotion } from "./motion";
import { describe, test, expect } from "vitest";

describe("HarmonicMotion class tests", () => {
  test("attaches to a group and updates rotation while holding down the key", async () => {
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

    // Simulate holding down the ArrowUp key
    motion.handleKeyDown({ key: "ArrowUp" } as KeyboardEvent);

    // Allow the spring to update over time
    await new Promise((resolve) => setTimeout(resolve, 100)); // Adjust timing as needed

    // Check that the rotation is not 0
    expect(group.rotation.x).not.toBe(0);

    // Optionally, ensure it's moving in the positive direction
    expect(group.rotation.x).toBeGreaterThan(0);
  });
});
