import React from "react";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import ParticleGenerator from "./particleGenerator";
import { describe, test, expect } from "vitest";

describe("ParticleGenerator component tests", () => {
  test("renders the ParticleGenerator component", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ParticleGenerator active={false} position={[0, 0, 0]} />,
    );
    const group = renderer.scene.children[0];
    expect(group).toBeDefined();
  });
});
