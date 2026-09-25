import React from "react";

import { resolveExhaustMode } from "./mode";
import { ExhaustMode, ExhaustRendererProps } from "./types";
import ParticleRenderer from "./renderers/particleRenderer";
import CloudRenderer from "./renderers/cloudRenderer";
import VoxelRenderer from "./renderers/voxelRenderer";

// Adding a new look is: write a renderer against the shared simulation
// (useExhaustSimulation), then add one line here.
const RENDERERS: Record<ExhaustMode, React.FC<ExhaustRendererProps>> = {
  particles: ParticleRenderer,
  clouds: CloudRenderer,
  voxels: VoxelRenderer,
};

/**
 * Picks which exhaust renderer to mount based on VITE_EXHAUST_MODE (see
 * ./mode.ts). All renderers accept the same props and share the same
 * underlying particle simulation, so switching modes is just swapping which
 * component draws the shared state. The boost light lives here rather than
 * per-renderer since "more light" reads the same regardless of jet look.
 */
const ExhaustGenerator: React.FC<ExhaustRendererProps> = (props) => {
  const Renderer = RENDERERS[resolveExhaustMode()];
  return (
    <>
      <Renderer {...props} />
      {props.boost && (
        <pointLight
          position={props.position}
          color="#ffcf8a"
          intensity={3}
          distance={5}
          decay={2}
        />
      )}
    </>
  );
};

export default ExhaustGenerator;
