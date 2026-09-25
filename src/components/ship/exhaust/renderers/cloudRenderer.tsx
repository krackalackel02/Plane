import React, { useRef } from "react";
import { Points } from "three";

import { smoothstep } from "../../../../utils/3d";
import { useExhaustSimulation } from "../useExhaustSimulation";
import { matteColorMap } from "../colorMaps";
import { ExhaustRendererProps } from "../types";
import { cloudVertexShader, cloudFragmentShader } from "./cloudMaterial";

// Base world-scale radius of a freshly spawned puff, before it blows out.
const BASE_SIZE = 6;

/**
 * "clouds" mode: billboarded pastel-turned-matte cumulus puffs. Size and
 * alpha are mode-specific rendering state (not part of the shared sim) -
 * puffs blow out (grow) early in life, then keep expanding while fading
 * out, so dispersal reads as "wider and more transparent" rather than a
 * dot just shrinking away.
 */
const CloudRenderer: React.FC<ExhaustRendererProps> = ({
  active,
  position,
  count = 100,
  coneAngle = Math.PI / 6,
  decaySpeed = 0.01,
  speedDecay = 0.98,
  reverse = false,
  boost = false,
}) => {
  const particlesRef = useRef<Points>(null);
  const alphas = useRef(new Float32Array(count));
  const sizes = useRef(new Float32Array(count));
  const rotations = useRef(new Float32Array(count));

  useExhaustSimulation({
    active,
    count,
    coneAngle,
    decaySpeed,
    speedDecay,
    reverse,
    colorMap: matteColorMap,
    onStep: (state, spawnedIndex) => {
      const mesh = particlesRef.current;
      if (!mesh) return;

      for (let i = 0; i < count; i++) {
        if (state.lifetimes[i] <= 0) {
          alphas.current[i] = 0;
          sizes.current[i] = 0;
          continue;
        }

        // Puff grows ("blown out") as it ages, then keeps widening while it
        // fades out ("disperse").
        const age = 1 - state.lifetimes[i]; // 0 at spawn -> 1 at death
        const blowout = smoothstep(0, 0.3, age);
        const drift = age > 0.3 ? (age - 0.3) / 0.7 : 0;
        const boostScale = boost ? 1.35 : 1;
        sizes.current[i] =
          BASE_SIZE * boostScale * (0.5 + blowout * 0.9 + drift * 1.1);

        const fadeIn = smoothstep(0, 0.06, age);
        const fadeOut = 1 - smoothstep(0.4, 1, age);
        alphas.current[i] = fadeIn * fadeOut;
      }

      if (spawnedIndex !== null) {
        rotations.current[spawnedIndex] = Math.random() * Math.PI * 2;
      }

      const { attributes } = mesh.geometry;
      (attributes.position.array as Float32Array).set(state.positions);
      (attributes.color.array as Float32Array).set(state.colors);
      (attributes.alpha.array as Float32Array).set(alphas.current);
      (attributes.size.array as Float32Array).set(sizes.current);
      (attributes.rotation.array as Float32Array).set(rotations.current);
      attributes.position.needsUpdate = true;
      attributes.color.needsUpdate = true;
      attributes.alpha.needsUpdate = true;
      attributes.size.needsUpdate = true;
      attributes.rotation.needsUpdate = true;
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
          <bufferAttribute
            attach="attributes-alpha"
            array={new Float32Array(count)}
            count={count}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-size"
            array={new Float32Array(count)}
            count={count}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-rotation"
            array={new Float32Array(count)}
            count={count}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={cloudVertexShader}
          fragmentShader={cloudFragmentShader}
          transparent
          depthWrite={false}
        />
      </points>
    </group>
  );
};

export default CloudRenderer;
