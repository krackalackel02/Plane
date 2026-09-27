import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ExhaustModeButton from "./exhaustModeButton";
import { useExhaustModeContext } from "../../context/exhaustModeContext";

vi.mock("../../context/exhaustModeContext", async () => {
  const actual = await vi.importActual<
    typeof import("../../context/exhaustModeContext")
  >("../../context/exhaustModeContext");
  return {
    ...actual,
    useExhaustModeContext: vi.fn(),
  };
});

const mockedUseExhaustModeContext = vi.mocked(useExhaustModeContext);

describe("ExhaustModeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the trigger label reflecting the current mode", () => {
    mockedUseExhaustModeContext.mockReturnValue({
      mode: "clouds",
      setMode: vi.fn(),
    });
    render(<ExhaustModeButton />);

    expect(
      screen.getByLabelText("Exhaust style: Clouds (open to switch)"),
    ).toBeInTheDocument();
  });

  it("renders all three exhaust modes in the fan", () => {
    mockedUseExhaustModeContext.mockReturnValue({
      mode: "particles",
      setMode: vi.fn(),
    });
    render(<ExhaustModeButton />);
    fireEvent.click(
      screen.getByLabelText("Exhaust style: Particles (open to switch)"),
    );

    expect(
      screen.getByLabelText("Switch exhaust style to Particles"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Switch exhaust style to Clouds"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Switch exhaust style to Voxels"),
    ).toBeInTheDocument();
  });

  it("marks only the current mode's node active, the others inactive", () => {
    mockedUseExhaustModeContext.mockReturnValue({
      mode: "voxels",
      setMode: vi.fn(),
    });
    render(<ExhaustModeButton />);
    fireEvent.click(
      screen.getByLabelText("Exhaust style: Voxels (open to switch)"),
    );

    expect(
      screen.getByLabelText("Switch exhaust style to Particles"),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByLabelText("Switch exhaust style to Clouds"),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByLabelText("Switch exhaust style to Voxels"),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("clicking a mode node calls setMode with that mode and closes the fan", () => {
    const setMode = vi.fn();
    mockedUseExhaustModeContext.mockReturnValue({ mode: "particles", setMode });
    render(<ExhaustModeButton />);
    const trigger = screen.getByLabelText(
      "Exhaust style: Particles (open to switch)",
    );
    fireEvent.click(trigger);

    fireEvent.click(screen.getByLabelText("Switch exhaust style to Clouds"));

    expect(setMode).toHaveBeenCalledWith("clouds");
    expect(setMode).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("clicking the already-active mode still calls setMode (idempotent re-select)", () => {
    const setMode = vi.fn();
    mockedUseExhaustModeContext.mockReturnValue({ mode: "voxels", setMode });
    render(<ExhaustModeButton />);
    fireEvent.click(
      screen.getByLabelText("Exhaust style: Voxels (open to switch)"),
    );

    fireEvent.click(screen.getByLabelText("Switch exhaust style to Voxels"));

    expect(setMode).toHaveBeenCalledWith("voxels");
  });
});
