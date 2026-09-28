import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AudioButton from "./audioButton";
import { useAudioContext } from "../../context/audioContext";

vi.mock("../../context/audioContext", () => ({
  useAudioContext: vi.fn(),
}));

const mockedUseAudioContext = vi.mocked(useAudioContext);

const setContext = (
  overrides: Partial<ReturnType<typeof useAudioContext>> = {},
) => {
  mockedUseAudioContext.mockReturnValue({
    muted: false,
    toggleMute: vi.fn(),
    musicEnabled: true,
    toggleMusic: vi.fn(),
    sfxEnabled: true,
    toggleSfx: vi.fn(),
    ...overrides,
  });
};

describe("AudioButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an 'Unmuted' trigger label when not muted", () => {
    setContext({ muted: false });
    render(<AudioButton />);

    expect(
      screen.getByLabelText("Audio: Unmuted (open to adjust)"),
    ).toBeInTheDocument();
  });

  it("shows a 'Muted' trigger label when muted", () => {
    setContext({ muted: true });
    render(<AudioButton />);

    expect(
      screen.getByLabelText("Audio: Muted (open to adjust)"),
    ).toBeInTheDocument();
  });

  it("renders all three sub-nodes: Mute, Background music, Sound effects", () => {
    setContext();
    render(<AudioButton />);
    fireEvent.click(screen.getByLabelText("Audio: Unmuted (open to adjust)"));

    expect(screen.getByLabelText("Mute")).toBeInTheDocument();
    expect(screen.getByLabelText("Background music")).toBeInTheDocument();
    expect(screen.getByLabelText("Sound effects")).toBeInTheDocument();
  });

  it("reflects each node's active/checked state from context", () => {
    setContext({ muted: true, musicEnabled: false, sfxEnabled: true });
    render(<AudioButton />);
    fireEvent.click(screen.getByLabelText("Audio: Muted (open to adjust)"));

    expect(screen.getByLabelText("Mute")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Background music")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByLabelText("Sound effects")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("clicking Mute calls toggleMute", () => {
    const toggleMute = vi.fn();
    setContext({ toggleMute });
    render(<AudioButton />);
    fireEvent.click(screen.getByLabelText("Audio: Unmuted (open to adjust)"));

    fireEvent.click(screen.getByLabelText("Mute"));

    expect(toggleMute).toHaveBeenCalledTimes(1);
  });

  it("clicking Background music calls toggleMusic", () => {
    const toggleMusic = vi.fn();
    setContext({ toggleMusic });
    render(<AudioButton />);
    fireEvent.click(screen.getByLabelText("Audio: Unmuted (open to adjust)"));

    fireEvent.click(screen.getByLabelText("Background music"));

    expect(toggleMusic).toHaveBeenCalledTimes(1);
  });

  it("clicking Sound effects calls toggleSfx", () => {
    const toggleSfx = vi.fn();
    setContext({ toggleSfx });
    render(<AudioButton />);
    fireEvent.click(screen.getByLabelText("Audio: Unmuted (open to adjust)"));

    fireEvent.click(screen.getByLabelText("Sound effects"));

    expect(toggleSfx).toHaveBeenCalledTimes(1);
  });

  it("each sub-node is an independent toggle (menuitemcheckbox), not a mutually-exclusive picker", () => {
    setContext();
    render(<AudioButton />);
    fireEvent.click(screen.getByLabelText("Audio: Unmuted (open to adjust)"));

    expect(screen.getByLabelText("Mute")).toHaveAttribute(
      "role",
      "menuitemcheckbox",
    );
    expect(screen.getByLabelText("Background music")).toHaveAttribute(
      "role",
      "menuitemcheckbox",
    );
    expect(screen.getByLabelText("Sound effects")).toHaveAttribute(
      "role",
      "menuitemcheckbox",
    );
  });
});
