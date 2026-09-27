import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { deviceState } = vi.hoisted(() => ({
  deviceState: { isMobile: false },
}));

vi.mock("react-device-detect", () => ({
  get isMobile() {
    return deviceState.isMobile;
  },
}));

// LoadingProvider only needs useProgress's shape from @react-three/drei -
// mocking the whole module (rather than letting it load for real) avoids
// dragging in an unrelated transitive dependency that breaks under jsdom
// without a canvas polyfill.
vi.mock("@react-three/drei", () => ({
  useProgress: () => ({ active: false, loaded: 0, total: 0 }),
}));

import WelcomeOverlay from "./welcomeOverlay";
import HelpButton from "./helpButton";
import { WelcomeProvider, SETTLE_DELAY_MS } from "./welcomeContext";
import { LoadingProvider, useLoading } from "../../context/loadingContext";
import { GLITCH_EXIT_MS } from "./glitchTiming";

// Exposes LoadingContext's notifyIntroComplete to the test, standing in for
// Camera calling it from the real GSAP timeline's onComplete.
let latestNotifyIntroComplete: (() => void) | null = null;
const IntroCompleteTrigger = () => {
  const { notifyIntroComplete } = useLoading();
  latestNotifyIntroComplete = notifyIntroComplete;
  return null;
};

// Mirrors how scene.tsx composes these: LoadingProvider wraps everything
// (it's the source Camera also reads from), and WelcomeOverlay (intro alert
// + help modal) / HelpButton (the persistent "?" toggle) are DOM siblings,
// kept in sync via WelcomeContext rather than one containing the other.
const renderWelcome = () =>
  render(
    <LoadingProvider>
      <IntroCompleteTrigger />
      <WelcomeProvider>
        <WelcomeOverlay />
        <HelpButton />
      </WelcomeProvider>
    </LoadingProvider>,
  );

// Stands in for the camera's intro flythrough actually finishing (its real
// GSAP onComplete - see animate.ts/camera/index.tsx), not a fixed timer.
// Two separate act() calls, deliberately: the first lets React flush the
// introComplete state update and run WelcomeProvider's effect that actually
// schedules its setTimeout - only then does advancing fake time (the
// second act()) have a timer to fire.
const settle = () => {
  act(() => {
    latestNotifyIntroComplete?.();
  });
  act(() => {
    vi.advanceTimersByTime(SETTLE_DELAY_MS);
  });
};

// The exit ("glitch-out") animation keeps a dismissed popup mounted for a
// beat before it's actually removed - advance past that before asserting.
const finishExit = () =>
  act(() => {
    vi.advanceTimersByTime(GLITCH_EXIT_MS);
  });

describe("WelcomeOverlay + HelpButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    deviceState.isMobile = false;
    latestNotifyIntroComplete = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Regression test: the popup used to run off a fixed setTimeout started
  // the moment WelcomeProvider mounted, oblivious to the fact that the
  // camera animation itself doesn't start until assets finish loading (it's
  // gated on LoadingContext's `ready`) - so the timer could fire while the
  // world was still loading, well before the camera had actually settled.
  // It must now stay hidden no matter how much time passes, until the real
  // completion signal fires.
  it("renders nothing until the intro camera animation actually completes - not merely after a fixed delay", () => {
    renderWelcome();
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();

    settle();
    expect(screen.getByRole("dialog", { name: "Welcome" })).toBeTruthy();
  });

  it("shows the welcome alert once the camera settles, and a help button appears only after it's dismissed", () => {
    renderWelcome();
    settle();

    expect(screen.getByRole("dialog", { name: "Welcome" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show controls" })).toBeNull();
  });

  it("dismisses on close-button click and reveals the help button", () => {
    renderWelcome();
    settle();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    finishExit();

    expect(screen.queryByRole("dialog", { name: "Welcome" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show controls" })).toBeTruthy();
  });

  it("dismisses on backdrop click but not on clicks inside the alert", () => {
    renderWelcome();
    settle();

    fireEvent.click(screen.getByRole("dialog", { name: "Welcome" }));
    expect(screen.getByRole("dialog", { name: "Welcome" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("dialog", { name: "Welcome" }).parentElement!,
    );
    finishExit();
    expect(screen.queryByRole("dialog", { name: "Welcome" })).toBeNull();
  });

  it("auto-dismisses after the estimated read time plus grace period", () => {
    renderWelcome();
    settle();
    expect(screen.getByRole("dialog", { name: "Welcome" })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(screen.queryByRole("dialog", { name: "Welcome" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show controls" })).toBeTruthy();
  });

  it("opens the help modal with PC controls on desktop", () => {
    renderWelcome();
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    finishExit();
    fireEvent.click(screen.getByRole("button", { name: "Show controls" }));

    expect(screen.getByRole("dialog", { name: "Controls" })).toBeTruthy();
    expect(screen.getByText("W")).toBeTruthy();
    expect(screen.getByText("Space")).toBeTruthy();
  });

  it("opens the help modal with joystick controls on mobile", () => {
    deviceState.isMobile = true;
    renderWelcome();
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    finishExit();
    fireEvent.click(screen.getByRole("button", { name: "Show controls" }));

    expect(screen.getByRole("dialog", { name: "Controls" })).toBeTruthy();
    expect(screen.queryByText("W")).toBeNull();
  });

  it("closes the help modal via its close button", () => {
    renderWelcome();
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    finishExit();
    fireEvent.click(screen.getByRole("button", { name: "Show controls" }));

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    finishExit();
    expect(screen.queryByRole("dialog", { name: "Controls" })).toBeNull();
  });
});
