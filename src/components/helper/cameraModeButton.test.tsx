import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CameraModeButton from "./cameraModeButton";
import { useCameraMode, CameraMode } from "../../context/cameraModeContext";

vi.mock("../../context/cameraModeContext", async () => {
  const actual = await vi.importActual<
    typeof import("../../context/cameraModeContext")
  >("../../context/cameraModeContext");
  return {
    ...actual,
    useCameraMode: vi.fn(),
  };
});

const mockedUseCameraMode = vi.mocked(useCameraMode);

const mockMode = (mode: CameraMode, setMode = vi.fn()) => {
  mockedUseCameraMode.mockReturnValue({
    mode,
    setMode,
  } as unknown as ReturnType<typeof useCameraMode>);
  return setMode;
};

describe("CameraModeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The same speed-dial as the audio and exhaust buttons, not a lookalike:
  // they share every fix that template carries (single-tap on touch, the
  // hover bridge, keeping the fan on-screen).
  it("is built on the shared RadialNodeMenu, like the audio and exhaust buttons", () => {
    mockMode("medium");
    const { container } = render(<CameraModeButton />);

    expect(container.querySelector(".radial-node-menu")).not.toBeNull();
    expect(container.querySelector(".radial-node-menu__fan")).not.toBeNull();
  });

  it("shows the trigger label reflecting the current framing", () => {
    mockMode("max");
    render(<CameraModeButton />);

    expect(
      screen.getByLabelText("Camera framing: Zoomed Out (open to switch)"),
    ).toBeInTheDocument();
  });

  it("fans out all three framings, only the current one active", () => {
    mockMode("close");
    render(<CameraModeButton />);
    fireEvent.click(
      screen.getByLabelText("Camera framing: Close (open to switch)"),
    );

    expect(
      screen.getByLabelText("Switch camera framing to Close"),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByLabelText("Switch camera framing to Medium"),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByLabelText("Switch camera framing to Zoomed Out"),
    ).toHaveAttribute("aria-checked", "false");
  });

  // Close is the ship itself, medium a stretch of horizon with buildings on
  // it, far the whole ringed planet - each framing pictured by what it shows.
  it("pictures each framing by what it shows: the ship, a horizon, the whole ringed planet", () => {
    mockMode("medium");
    render(<CameraModeButton />);
    fireEvent.click(
      screen.getByLabelText("Camera framing: Medium (open to switch)"),
    );

    const pictureOf = (label: string) =>
      screen.getByLabelText(label).querySelector("svg")?.dataset.icon;
    expect(pictureOf("Switch camera framing to Close")).toBe("ship");
    expect(pictureOf("Switch camera framing to Medium")).toBe("horizon");
    expect(pictureOf("Switch camera framing to Zoomed Out")).toBe(
      "ringed-planet",
    );
  });

  it("picking a framing calls setMode with it and folds the fan back in", () => {
    const setMode = mockMode("close");
    render(<CameraModeButton />);
    const trigger = screen.getByLabelText(
      "Camera framing: Close (open to switch)",
    );
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByLabelText("Switch camera framing to Medium"));

    expect(setMode).toHaveBeenCalledWith("medium");
    expect(setMode).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
