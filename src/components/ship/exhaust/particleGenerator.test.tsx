import React from "react";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { Points } from "three";
import ParticleGenerator from "./particleGenerator";
import { describe, test, expect } from "vitest";

describe("ParticleGenerator component tests", () => {
  test("renders the ParticleGenerator component", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ParticleGenerator active={false} position={[0, 0, 0]} />,
    );
    const group = renderer.scene.children[0];
    expect(group).toBeDefined();
  });

  // Regression test for a bug where an already-spawned particle's direction
  // of travel was re-decided every frame from the live `reverse` prop
  // instead of being fixed once at spawn time. That meant releasing reverse
  // throttle (reverse: true -> false) made every still-alive particle from
  // the reverse thrust instantly reverse course mid-flight - visible as a
  // stray burst in the opposite direction right as the key came up.
  test("a spawned particle keeps moving the same way after `reverse` later changes", async () => {
    // coneAngle=0 forces phi=0 on every spawn, making the z velocity
    // deterministic: zSign * 0.2.
    const renderer = await ReactThreeTestRenderer.create(
      <ParticleGenerator
        active={true}
        reverse={true}
        position={[0, 0, 0]}
        count={4}
        coneAngle={0}
      />,
    );

    const points = renderer.scene.findByType("Points")
      .instance as unknown as Points;
    const positions = points.geometry.attributes.position.array as Float32Array;

    await renderer.advanceFrames(2, 0.016); // spawn, then one step of travel
    const zWhileHeld = positions[2]; // particle 0's z

    // Simulate releasing the key: active and reverse both go false in the
    // same update, same as Exhaust does when direction becomes "neutral".
    await renderer.update(
      <ParticleGenerator
        active={false}
        reverse={false}
        position={[0, 0, 0]}
        count={4}
        coneAngle={0}
      />,
    );
    await renderer.advanceFrames(1, 0.016);
    const zAfterRelease = positions[2];

    expect(zWhileHeld).toBeGreaterThan(0);
    // Keeps moving in the same direction (further from 0), not reversing.
    expect(Math.sign(zAfterRelease - zWhileHeld)).toBe(Math.sign(zWhileHeld));
  });

  // Regression test for a bug where the position/color buffer arrays were
  // created inline in JSX (`array={new Float32Array(...)}`), so every
  // re-render replaced the geometry's actual buffers with a fresh
  // all-zero array - silently discarding every particle's position and
  // color. Since this component re-renders on every key press/release
  // (Exhaust re-renders on any activeKeys change), this snapped the whole
  // exhaust trail back to the jet origin at every control transition.
  test("re-rendering with new props keeps the same buffer array (doesn't wipe particle data)", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ParticleGenerator
        active={true}
        position={[0, 0, 0]}
        count={4}
        coneAngle={0}
      />,
    );

    const getPositionArray = () =>
      (renderer.scene.findByType("Points").instance as unknown as Points)
        .geometry.attributes.position.array;

    await renderer.advanceFrames(2, 0.016);
    const arrayBeforeRerender = getPositionArray();
    expect(arrayBeforeRerender[2]).not.toBe(0);

    // Re-render with different props, as happens whenever Exhaust
    // re-renders for any reason (any activeKeys change, not just this jet's
    // own active/reverse).
    await renderer.update(
      <ParticleGenerator
        active={true}
        position={[0, 1, 0]}
        count={4}
        coneAngle={0}
      />,
    );

    // Must be the literal same array, still carrying the particle data
    // written into it - not a fresh all-zero replacement.
    expect(getPositionArray()).toBe(arrayBeforeRerender);
  });
});
