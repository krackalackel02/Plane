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

  // Regression test: anything waiting for the intro to "finish" (e.g. the
  // welcome popup) must be told via this real GSAP completion, not a
  // guessed duration - a fixed timer can't know the camera's actual start
  // time, which itself already shifts with `ready`.
  test("calls onComplete only once the full keyframe sequence has actually played through", () => {
    const camera = new THREE.PerspectiveCamera();
    const timelineSpy = vi.spyOn(gsap, "timeline");
    const onComplete = vi.fn();

    renderHook(() => animate(camera, true, onComplete));

    const timeline = timelineSpy.mock.results[0].value;

    timeline.progress(0.5);
    expect(onComplete).not.toHaveBeenCalled();

    timeline.progress(1);
    expect(onComplete).toHaveBeenCalledTimes(1);

    timelineSpy.mockRestore();
  });

  // Regression test: picking a camera mode other than the one kframe.json
  // happens to end on (see cameraModeContext) shouldn't need its own
  // bespoke hand-tuned sweep - animate() should just tack one more leg onto
  // the existing sweep, landing on whatever preset it's given.
  test("ends at finalTarget instead of kframe.json's own last frame, when one is given", () => {
    const camera = new THREE.PerspectiveCamera();
    const timelineSpy = vi.spyOn(gsap, "timeline");
    const finalTarget = {
      position: { x: 111, y: 222, z: 333 },
      lookingAt: { x: 0.1, y: 0.2, z: 0.3 },
    };

    renderHook(() => animate(camera, true, undefined, undefined, finalTarget));

    const timeline = timelineSpy.mock.results[0].value;
    timeline.progress(1);

    expect(camera.position.x).toBeCloseTo(finalTarget.position.x, 5);
    expect(camera.position.y).toBeCloseTo(finalTarget.position.y, 5);
    expect(camera.position.z).toBeCloseTo(finalTarget.position.z, 5);

    timelineSpy.mockRestore();
  });

  // Regression test: this is the actual bug being fixed - switching camera
  // modes (see cameraModeContext) well after the intro has already
  // finished playing was retriggering the entire sweep from the start,
  // because a fresh finalTarget object (a new preset) was in the effect's
  // own dependency array. The timeline must only ever be built once, no
  // matter how many times finalTarget's identity changes afterward.
  test("changing finalTarget's identity on a later render does not rebuild (and so does not replay) the timeline", () => {
    const camera = new THREE.PerspectiveCamera();
    const timelineSpy = vi.spyOn(gsap, "timeline");
    const firstTarget = {
      position: { x: 1, y: 2, z: 3 },
      lookingAt: { x: 0, y: 0, z: 1 },
    };
    const secondTarget = {
      position: { x: 4, y: 5, z: 6 },
      lookingAt: { x: 1, y: 0, z: 0 },
    };

    const { rerender } = renderHook(
      ({ finalTarget }) =>
        animate(camera, true, undefined, undefined, finalTarget),
      { initialProps: { finalTarget: firstTarget } },
    );

    expect(timelineSpy).toHaveBeenCalledTimes(1);

    // Simulates picking a different camera mode - a brand new preset object.
    rerender({ finalTarget: secondTarget });

    expect(timelineSpy).toHaveBeenCalledTimes(1);

    timelineSpy.mockRestore();
  });

  test("without a finalTarget, still ends at kframe.json's own last frame (unchanged behavior)", () => {
    const camera = new THREE.PerspectiveCamera();
    const timelineSpy = vi.spyOn(gsap, "timeline");

    renderHook(() => animate(camera, true));

    const timeline = timelineSpy.mock.results[0].value;
    timeline.progress(1);

    const lastFrame = anim.frames[anim.frames.length - 1];
    expect(camera.position.x).toBeCloseTo(lastFrame.position.x, 5);
    expect(camera.position.y).toBeCloseTo(lastFrame.position.y, 5);
    expect(camera.position.z).toBeCloseTo(lastFrame.position.z, 5);

    timelineSpy.mockRestore();
  });
});
