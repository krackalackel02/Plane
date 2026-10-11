import { describe, expect, test } from "vitest";
import { isSoftwareRendered, isSoftwareRendererName } from "./renderCapability";

describe("isSoftwareRendererName", () => {
  test.each([
    // Headless Chrome / CI, and Chrome's fallback with no usable GPU.
    "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
    "Google SwiftShader",
    // Mesa on Linux without a GPU.
    "llvmpipe (LLVM 15.0.7, 256 bits)",
    "softpipe",
    // Windows without a GPU driver.
    "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)",
  ])("recognises a CPU rasteriser: %s", (renderer) => {
    expect(isSoftwareRendererName(renderer)).toBe(true);
  });

  test.each([
    "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)",
    "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
    "Adreno (TM) 750",
    "Mali-G715",
    "Apple GPU",
  ])("leaves a real GPU at full quality: %s", (renderer) => {
    expect(isSoftwareRendererName(renderer)).toBe(false);
  });
});

describe("isSoftwareRendered", () => {
  // jsdom has no WebGL to probe - the full-quality default applies.
  test("assumes a GPU where there's no WebGL to ask", () => {
    expect(isSoftwareRendered()).toBe(false);
  });
});
