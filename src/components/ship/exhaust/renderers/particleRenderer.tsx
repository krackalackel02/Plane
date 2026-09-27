import React, { useRef } from "react";
import { Points } from "three";

import { useExhaustSimulation } from "../useExhaustSimulation";
import {
  particleColorMap,
  applyBoostTint,
  BOOST_SIZE_MULTIPLIER,
} from "../colorMaps";
import { ExhaustRendererProps } from "../types";

const BASE_SIZE = 0.05;

/**
 * "particles" mode: the original plain point-sprite dots, driven by the
 * shared simulation. No mode-specific per-particle state beyond the boost
 * color tint - it's otherwise a straight read of position/color each frame.
 */
const ParticleRenderer: React.FC<ExhaustRendererProps> = ({
  active,
  position,
  count = 200,
  coneAngle = Math.PI / 6,
  decaySpeed = 0.01,
  speedDecay = 0.98,
  reverse = false,
  boost = false,
}) => {
  const particlesRef = useRef<Points>(null);
  const colors = useRef(new Float32Array(count * 3));

  useExhaustSimulation({
    active,
    count,
    coneAngle,
    decaySpeed,
    speedDecay,
    reverse,
    colorMap: particleColorMap,
    onStep: (state) => {
      const mesh = particlesRef.current;
      if (!mesh) return;

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        if (boost && state.lifetimes[i] > 0) {
          const [r, g, b] = applyBoostTint(
            state.colors[idx],
            state.colors[idx + 1],
            state.colors[idx + 2],
          );
          colors.current.set([r, g, b], idx);
        } else {
          colors.current.set(
            [state.colors[idx], state.colors[idx + 1], state.colors[idx + 2]],
            idx,
          );
        }
      }

      const { attributes } = mesh.geometry;
      (attributes.position.array as Float32Array).set(state.positions);
      (attributes.color.array as Float32Array).set(colors.current);
      attributes.position.needsUpdate = true;
      attributes.color.needsUpdate = true;
    },
  });

  return (
    <group position={position}>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array(count * 3)}
            count={count}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={new Float32Array(count * 3)}
            count={count}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={boost ? BASE_SIZE * BOOST_SIZE_MULTIPLIER : BASE_SIZE}
          vertexColors
        />
      </points>
    </group>
  );
};

export default ParticleRenderer;
