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

    renderHook(() => animate(camera));

    const timeline = timelineSpy.mock.results[0].value;
    // Jump the timeline straight to completion instead of waiting on real time/RAF.
    timeline.progress(1);

    const lastFrame = anim.frames[anim.frames.length - 1];
    expect(camera.position.x).toBeCloseTo(lastFrame.position.x, 5);
    expect(camera.position.y).toBeCloseTo(lastFrame.position.y, 5);
    expect(camera.position.z).toBeCloseTo(lastFrame.position.z, 5);

    timelineSpy.mockRestore();
  });
});
