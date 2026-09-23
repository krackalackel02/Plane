import React, { useRef } from "react";
import { Points } from "three";

import { useExhaustSimulation } from "../useExhaustSimulation";
import { particleColorMap } from "../colorMaps";
import { ExhaustRendererProps } from "../types";

/**
 * "particles" mode: the original plain point-sprite dots, driven by the
 * shared simulation. No mode-specific per-particle state needed - it's a
 * straight read of position/color each frame.
 */
const ParticleRenderer: React.FC<ExhaustRendererProps> = ({
  active,
  position,
  count = 200,
  coneAngle = Math.PI / 6,
  decaySpeed = 0.01,
  speedDecay = 0.98,
  reverse = false,
}) => {
  const particlesRef = useRef<Points>(null);

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

      const { attributes } = mesh.geometry;
      (attributes.position.array as Float32Array).set(state.positions);
      (attributes.color.array as Float32Array).set(state.colors);
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
        <pointsMaterial size={0.05} vertexColors />
      </points>
    </group>
  );
};

export default ParticleRenderer;
