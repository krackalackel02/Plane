import * as THREE from "three";
import gsap from "gsap";
import { renderHook } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import animate from "./animate";
import anim from "./kframe.json";

describe("camera intro animation", () => {
  test("moves the camera through the full keyframe sequence", () => {
    const camera = new THREE.PerspectiveCamera();
    const timelineSpy = vi.spyOn(gsap, "timeline");

    renderHook(() => animate(camera, true));

    const timeline = timelineSpy.mock.results[0].value;
    // Jump the timeline straight to completion instead of waiting on real time/RAF.
    timeline.progress(1);

    const lastFrame = anim.frames[anim.frames.length - 1];
    expect(camera.position.x).toBeCloseTo(lastFrame.position.x, 5);
    expect(camera.position.y).toBeCloseTo(lastFrame.position.y, 5);
    expect(camera.position.z).toBeCloseTo(lastFrame.position.z, 5);

    timelineSpy.mockRestore();
  });

  // Regression test: the intro flythrough must not start until assets have
  // finished loading, otherwise it plays over an empty/half-built scene.
  test("does not start until assets are ready", () => {
    const camera = new THREE.PerspectiveCamera();
    const timelineSpy = vi.spyOn(gsap, "timeline");

    const { rerender } = renderHook(({ ready }) => animate(camera, ready), {
      initialProps: { ready: false },
    });

    expect(timelineSpy).not.toHaveBeenCalled();

    rerender({ ready: true });

    expect(timelineSpy).toHaveBeenCalledTimes(1);

    timelineSpy.mockRestore();
  });
});
