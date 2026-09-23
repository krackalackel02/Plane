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

import WelcomeOverlay from "./welcomeOverlay";
import HelpButton from "./helpButton";
import { WelcomeProvider } from "./welcomeContext";
import { INTRO_ANIMATION_DURATION_MS } from "../camera/animate";
import { GLITCH_EXIT_MS } from "./glitchTiming";

// Mirrors how scene.tsx composes these: WelcomeOverlay (intro alert + help
// modal) and HelpButton (the persistent "?" toggle) are DOM siblings, kept
// in sync via WelcomeContext rather than one containing the other.
const renderWelcome = () =>
  render(
    <WelcomeProvider>
      <WelcomeOverlay />
      <HelpButton />
    </WelcomeProvider>,
  );

const settle = () =>
  act(() => {
    vi.advanceTimersByTime(INTRO_ANIMATION_DURATION_MS + 501);
  });

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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing until the intro camera animation has settled", () => {
    renderWelcome();
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(INTRO_ANIMATION_DURATION_MS);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
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
