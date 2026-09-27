import React from "react";

import { useExhaustModeContext } from "../../../context/exhaustModeContext";
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
 * Picks which exhaust renderer to mount based on the current exhaust mode
 * (see ../../../context/exhaustModeContext.tsx - defaults from
 * VITE_EXHAUST_MODE, then switchable live via the HUD button). All
 * renderers accept the same props and share the same underlying particle
 * simulation, so switching modes is just swapping which component draws
 * the shared state. The boost light lives here rather than per-renderer
 * since "more light" reads the same regardless of jet look.
 */
const ExhaustGenerator: React.FC<ExhaustRendererProps> = (props) => {
  const { mode } = useExhaustModeContext();
  const Renderer = RENDERERS[mode];
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
