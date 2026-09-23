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

type Sample = { ready: boolean; progress: number };
const captured: Sample[] = [];
const Probe = () => {
  const { ready, progress } = useLoading();
  captured.push({ ready, progress });
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

  const progressValues = () => captured.map((s) => s.progress);

  test("climbs toward 99% over the average-load estimate and holds there while still loading", () => {
    captured.length = 0;
    Object.assign(progressState, { active: false, loaded: 0, total: 0 });

    render(
      <LoadingProvider>
        <Probe />
      </LoadingProvider>,
    );

    advanceFrame(0); // primes the loop's internal timestamp baseline

    // Half of the ~2.2s average-load estimate: partway up the climb.
    advanceFrame(1100);
    const halfway = captured[captured.length - 1].progress;
    expect(halfway).toBeGreaterThan(30);
    expect(halfway).toBeLessThan(70);

    // Well past the estimate, but the (mocked) manager still says loading.
    advanceFrame(3000);
    const held = captured[captured.length - 1].progress;
    expect(held).toBeCloseTo(99, 5);
    expect(captured[captured.length - 1].ready).toBe(false);

    // Keeps holding at 99% rather than creeping past it while still loading.
    advanceFrame(1000);
    expect(captured[captured.length - 1].progress).toBeCloseTo(99, 5);

    const values = progressValues();
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  test("spins the rest of the way to 100 and becomes ready once assets actually finish", () => {
    captured.length = 0;

    const { rerender } = render(
      <LoadingProvider>
        <Probe />
      </LoadingProvider>,
    );
    advanceFrame(0);

    Object.assign(progressState, { active: true, loaded: 0, total: 9 });
    rerender(
      <LoadingProvider>
        <Probe />
      </LoadingProvider>,
    );
    advanceFrame(500);
    expect(captured[captured.length - 1].progress).toBeLessThan(99);
    expect(captured[captured.length - 1].ready).toBe(false);

    // The manager reports everything has finished.
    Object.assign(progressState, { active: false, loaded: 9, total: 9 });
    rerender(
      <LoadingProvider>
        <Probe />
      </LoadingProvider>,
    );

    // First tick after "done" just establishes the finish-spin's start time
    // (mirrors how a real frame's timestamp seeds the ramp); subsequent
    // frames are what actually advance it.
    advanceFrame(0);
    advanceFrame(300); // > FINISH_SPIN_MS, so the ramp completes

    const last = captured[captured.length - 1];
    expect(last.progress).toBe(100);
    expect(last.ready).toBe(true);

    const values = progressValues();
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});
