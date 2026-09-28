import React from "react";
import { render } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import * as THREE from "three";

const { animateMock, useEnvironmentMock, notifyIntroCompleteMock } = vi.hoisted(
  () => ({
    animateMock: vi.fn(),
    useEnvironmentMock: vi.fn(),
    notifyIntroCompleteMock: vi.fn(),
  }),
);

vi.mock("./animate", () => ({ default: animateMock }));

vi.mock("@react-three/fiber", () => ({
  useThree: () => ({ camera: new THREE.PerspectiveCamera() }),
  useFrame: () => {},
}));

vi.mock("@react-three/drei", () => ({
  PerspectiveCamera: () => null,
  OrbitControls: () => null,
  FlyControls: () => null,
}));

vi.mock("../../context/envContext", () => ({
  useEnvironment: () => useEnvironmentMock(),
}));

vi.mock("../../context/sceneContext", () => ({
  useScene: () => ({ shipRef: { current: null } }),
}));

vi.mock("../../context/autopilotContext", () => ({
  useAutopilot: () => ({ isFlying: false }),
}));

vi.mock("../../context/loadingContext", () => ({
  useLoading: () => ({
    ready: true,
    progress: 100,
    introComplete: false,
    notifyIntroComplete: notifyIntroCompleteMock,
  }),
}));

const testPreset = {
  position: { x: -22.46, y: 22.1, z: -39.2 },
  lookingAt: { x: 0.89, y: 0.45, z: -0.12 },
};

vi.mock("../../context/cameraModeContext", () => ({
  useCameraMode: () => ({
    mode: "medium",
    setMode: () => {},
    preset: testPreset,
  }),
}));

import Camera from "./index";

describe("Camera intro animation wiring", () => {
  beforeEach(() => {
    animateMock.mockClear();
  });

  // Regression test: production defaults have every VITE_SHOW_* flag unset
  // (falsy), so this reproduces the real prod config. A prior change swapped
  // the destructured flag and inverted the condition, which silently disabled
  // the intro animation in prod - see PR #14.
  test("plays the intro animation under normal (non-debug) config", () => {
    useEnvironmentMock.mockReturnValue({ showCameraHelper: false });

    render(<Camera />);

    expect(animateMock).toHaveBeenCalledTimes(1);
    // The real completion signal (see loadingContext.tsx) must actually
    // reach animate() - a stale/omitted arg here would silently break
    // anything downstream that waits for the intro to truly finish (e.g.
    // the welcome popup), regressing it back to a mount-relative guess.
    expect(animateMock).toHaveBeenCalledWith(
      expect.anything(),
      true,
      notifyIntroCompleteMock,
      undefined, // ship anchor - undefined here since the mocked shipRef.current is null
      testPreset, // the intro's final leg target - see cameraModeContext
    );
  });

  // Regression test: the camera-helper debug view used to skip the intro
  // entirely, so watching the flythrough and reading live position/lookAt
  // coordinates off the debug overlay were mutually exclusive. The helper
  // should only add the free-orbit controls and readout on top, not replace
  // the intro.
  test("still plays the intro animation while the camera-helper debug view is active", () => {
    useEnvironmentMock.mockReturnValue({ showCameraHelper: true });

    render(<Camera />);

    expect(animateMock).toHaveBeenCalledTimes(1);
  });
});
