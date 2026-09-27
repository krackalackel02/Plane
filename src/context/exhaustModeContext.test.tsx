import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import {
  ExhaustModeProvider,
  useExhaustModeContext,
} from "./exhaustModeContext";

const STORAGE_KEY = "plane:exhaust-mode";

describe("ExhaustModeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to the env-resolved mode when nothing is stored", () => {
    const { result } = renderHook(() => useExhaustModeContext(), {
      wrapper: ExhaustModeProvider,
    });
    expect(result.current.mode).toBe("voxels");
  });

  it("restores a previously stored mode", () => {
    window.localStorage.setItem(STORAGE_KEY, "clouds");
    const { result } = renderHook(() => useExhaustModeContext(), {
      wrapper: ExhaustModeProvider,
    });
    expect(result.current.mode).toBe("clouds");
  });

  it("ignores a stored value that isn't a real mode", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-a-mode");
    const { result } = renderHook(() => useExhaustModeContext(), {
      wrapper: ExhaustModeProvider,
    });
    expect(result.current.mode).toBe("voxels");
  });

  it("setMode updates state and persists the choice", () => {
    const { result } = renderHook(() => useExhaustModeContext(), {
      wrapper: ExhaustModeProvider,
    });

    act(() => result.current.setMode("particles"));

    expect(result.current.mode).toBe("particles");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("particles");
  });
});
