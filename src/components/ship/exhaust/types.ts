export type ExhaustMode = "particles" | "clouds" | "voxels";

// Shared per-particle simulation state (position/velocity/lifetime/color),
// reused by every renderer regardless of how it chooses to draw a particle.
export interface ExhaustSimulationState {
  positions: Float32Array; // count * 3
  velocities: Float32Array; // count * 3
  lifetimes: Float32Array; // count, 1 (just spawned) -> 0 (dead)
  colors: Float32Array; // count * 3, derived from lifetime via a color map
}

export interface ExhaustRendererProps {
  active: boolean;
  position: [number, number, number];
  count?: number;
  coneAngle?: number;
  decaySpeed?: number;
  speedDecay?: number;
  reverse?: boolean;
  // True while the boost key is held and the jet is actually firing -
  // renderers scale their jet up/brighter so boosting reads clearly.
  boost?: boolean;
}
