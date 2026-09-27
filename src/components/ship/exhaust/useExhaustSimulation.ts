import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

import { precomputeRanges, getColorFromLifetime } from "../../../utils/3d";
import { ColorMapEntry, Range } from "../../types/colourTypes";
import { ExhaustSimulationState } from "./types";

interface UseExhaustSimulationOptions {
  active: boolean;
  count: number;
  coneAngle: number;
  decaySpeed: number;
  speedDecay: number;
  reverse: boolean;
  colorMap: ColorMapEntry[];
  // Called once per frame, after the simulation step, with the freshly
  // updated state and the index spawned this frame (or null). Renderers use
  // this to write whatever geometry/instance buffers they own.
  onStep: (state: ExhaustSimulationState, spawnedIndex: number | null) => void;
}

/**
 * Mode-agnostic exhaust particle simulation: spawn-in-a-cone, velocity decay,
 * lifetime countdown, and a lifetime-driven color spectrum. Every render mode
 * (plain particles, 2D cloud puffs, 3D voxel clouds, ...) drives its own
 * geometry from this same state via `onStep`, so the physics and the
 * close/fast-to-slow/far color concept only need to be implemented once.
 */
export const useExhaustSimulation = ({
  active,
  count,
  coneAngle,
  decaySpeed,
  speedDecay,
  reverse,
  colorMap,
  onStep,
}: UseExhaustSimulationOptions) => {
  const stateRef = useRef<ExhaustSimulationState | null>(null);
  if (!stateRef.current || stateRef.current.lifetimes.length !== count) {
    stateRef.current = {
      positions: new Float32Array(count * 3),
      velocities: new Float32Array(count * 3),
      lifetimes: new Float32Array(count),
      colors: new Float32Array(count * 3),
    };
  }

  const lastGeneratedIndex = useRef(0);
  const precomputedRanges = useRef<Range[]>(precomputeRanges(colorMap));
  precomputedRanges.current = precomputeRanges(colorMap);

  useFrame(() => {
    const state = stateRef.current;
    if (!state) return;
    const { positions, velocities, lifetimes, colors } = state;
    let spawnedIndex: number | null = null;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;

      if (lifetimes[i] <= 0) continue; // Skip dead particles

      // Update velocity with speed decay
      velocities[idx] *= speedDecay;
      velocities[idx + 1] *= speedDecay;
      velocities[idx + 2] *= speedDecay;

      // Update position based on velocity. The Z sign for reverse is baked
      // into velocities[idx + 2] at spawn time below, not decided here from
      // the live `reverse` prop - otherwise every already-alive particle
      // would flip its direction of travel the instant `reverse` toggles
      // (e.g. releasing reverse throttle), producing a visible burst of
      // particles suddenly reversing course mid-flight.
      positions[idx] += velocities[idx];
      positions[idx + 1] += velocities[idx + 1];
      positions[idx + 2] += velocities[idx + 2];

      // Decrease lifetime
      lifetimes[i] = Math.max(0, lifetimes[i] - decaySpeed);

      // Update color based on lifetime (close/fast -> first stop, slow/far -> last stop)
      const [r, g, b] = getColorFromLifetime(
        lifetimes[i],
        colorMap,
        precomputedRanges.current,
      );
      colors.set([r, g, b], idx);

      if (lifetimes[i] === 0) {
        // Avoid leaving dead particles at the origin. Keeping particles at
        // [0,0,0] can make point-sprite size calculations divide by a very
        // small view-space z and generate large/NaN point sizes which show
        // as black squares stuck on-screen. Move dead particles far off-
        // screen instead and clear their color.
        positions.set([1e6, 1e6, 1e6], idx);
        colors.set([0, 0, 0], idx);
      }
    }

    // Generate new particle if active
    if (active) {
      const i = lastGeneratedIndex.current;
      const idx = i * 3;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.random() * coneAngle;
      // Direction is fixed at spawn time from the current `reverse` prop -
      // see the update loop above for why it must not be re-read live.
      const zSign = reverse ? 1 : -1;

      velocities.set(
        [
          Math.sin(phi) * Math.cos(theta) * 0.2,
          Math.sin(phi) * Math.sin(theta) * 0.2,
          zSign * Math.cos(phi) * 0.2,
        ],
        idx,
      );

      positions.set([0, 0, 0], idx);
      lifetimes[i] = 1;
      colors.set(colorMap[0].color, idx);

      spawnedIndex = i;
      lastGeneratedIndex.current = (i + 1) % count;
    }

    onStep(state, spawnedIndex);
  });

  return stateRef;
};
