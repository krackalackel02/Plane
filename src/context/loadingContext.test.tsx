import React from "react";
import { render, act } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Mutable stand-in for three's DefaultLoadingManager state, as surfaced by
// drei's useProgress. Tests mutate this and rerender to simulate assets
// loading over time.
const progressState = { active: false, loaded: 0, total: 0 };

vi.mock("@react-three/drei", () => ({
  useProgress: () => ({ ...progressState }),
}));

import { LoadingProvider, useLoading } from "./loadingContext";

const captured: number[] = [];
const Probe = () => {
  const { progress } = useLoading();
  captured.push(progress);
  return null;
};

describe("LoadingProvider progress", () => {
  let rafCallbacks: FrameRequestCallback[];
  let now: number;

  beforeEach(() => {
    rafCallbacks = [];
    now = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Manually pumps the (mocked) requestAnimationFrame queue forward by a
  // fixed amount of wall-clock time, standing in for real frames.
  const advanceFrame = (ms: number) => {
    now += ms;
    const pending = rafCallbacks;
    rafCallbacks = [];
    act(() => {
      pending.forEach((cb) => cb(now));
    });
  };

  // Regression test: three's LoadingManager only reports progress when an
  // item *finishes*, and on a fast/local/cached load every item can finish
  // within the same manager tick - so the real ratio jumps straight from 0
  // to 100 with no elapsed time in between. The displayed number should
  // still be seen climbing gradually rather than snapping instantly.
  test("eases a same-tick 0->100 jump over real time instead of snapping, and never decreases", () => {
    captured.length = 0;
    Object.assign(progressState, { active: false, loaded: 0, total: 0 });

    const { rerender } = render(
      <LoadingProvider>
        <Probe />
      </LoadingProvider>,
    );

    // Prime the rAF loop's first frame (establishes its internal
    // last-timestamp baseline; no visible advancement from this alone).
    advanceFrame(0);

    // Everything finishes in the same manager tick, as it does locally.
    Object.assign(progressState, { active: true, loaded: 9, total: 9 });
    rerender(
      <LoadingProvider>
        <Probe />
      </LoadingProvider>,
    );

    const justAfterJump = captured[captured.length - 1];
    expect(justAfterJump).toBeLessThan(100);

    // Half a second in, it should be partway there - not still at the
    // instant-jump value and not yet fully caught up.
    advanceFrame(500);
    const midway = captured[captured.length - 1];
    expect(midway).toBeGreaterThan(justAfterJump);
    expect(midway).toBeLessThan(100);

    // Give it enough real time to fully catch up to the target.
    advanceFrame(2000);
    expect(captured[captured.length - 1]).toBe(100);

    for (let i = 1; i < captured.length; i++) {
      expect(captured[i]).toBeGreaterThanOrEqual(captured[i - 1]);
    }
  });
});
