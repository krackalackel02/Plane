import React from "react";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { describe, test, expect } from "vitest";

import ParticleRenderer from "./renderers/particleRenderer";
import CloudRenderer from "./renderers/cloudRenderer";
import VoxelRenderer from "./renderers/voxelRenderer";

describe.each([
  ["particles", ParticleRenderer],
  ["clouds", CloudRenderer],
  ["voxels", VoxelRenderer],
])("%s exhaust renderer", (_name, Renderer) => {
  test("renders without throwing", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Renderer active={false} position={[0, 0, 0]} />,
    );
    const group = renderer.scene.children[0];
    expect(group).toBeDefined();
  });
});
