import React, { useRef, useEffect } from "react";
import { Points } from "three";
import { useFrame } from "@react-three/fiber";

// Utilities for particle color and range computations
import {
  precomputeRanges,
  getColorFromLifetime,
  smoothstep,
} from "../../../utils/3d";
import { ColorMapEntry, Range } from "../../types/colourTypes";
import { smokeVertexShader, smokeFragmentShader } from "./smokeMaterial";

// Pastel spectrum: close/fast puffs (lifetime near 1) are pastel blue,
// slower/further puffs (lifetime decaying) shift to pastel red then cream.
const colorMap: ColorMapEntry[] = [
  { limit: 1, color: [0.68, 0.85, 0.98] }, // Pastel blue
  { limit: 0.9, color: [0.98, 0.74, 0.72] }, // Pastel red/coral
  { limit: 0.5, color: [0.99, 0.93, 0.78] }, // Pastel cream/yellow
];

// Precompute ranges for color interpolation
const precomputedRanges: Range[] = precomputeRanges(colorMap);

// Base world-scale radius of a freshly spawned puff, before it blows out.
const BASE_SIZE = 6;

/**
 * ParticleGenerator component to create and manage exhaust smoke puffs.
 * Props:
 * - active: boolean indicating if the generator is active
 * - position: [number, number, number] position of the generator
 * - count: number of particles to generate
 * - coneAngle: angle of the emission cone in radians
 * - decaySpeed: speed at which particles decay
 * - speedDecay: factor by which particle speed decays
 * - reverse: boolean indicating if particles should move in reverse
 */
interface ParticleGeneratorProps {
  active: boolean;
  position: [number, number, number];
  count?: number;
  coneAngle?: number;
  decaySpeed?: number;
  speedDecay?: number;
  reverse?: boolean;
}

const ParticleGenerator: React.FC<ParticleGeneratorProps> = ({
  active,
  position,
  count = 100,
  coneAngle = Math.PI / 6,
  decaySpeed = 0.01,
  speedDecay = 0.98,
  reverse = false,
}) => {
  // References and state for particles
  const particlesRef = useRef<Points>(null);
  const velocities = useRef<Float32Array>(new Float32Array(count * 3));
  const lifetimes = useRef<Float32Array>(new Float32Array(count));

  const lastGeneratedIndex = useRef(0);
  const isInitialized = useRef(false);

  // Initialize particle positions, colors, and puff attributes
  useEffect(() => {
    if (isInitialized.current) return; // Prevent re-initialization
    if (!particlesRef.current) return; // Ensure the ref is set

    const { attributes } = particlesRef.current.geometry;
    const positions = attributes.position.array as Float32Array;
    const colors = attributes.color.array as Float32Array;
    const alphas = attributes.alpha.array as Float32Array;
    const sizes = attributes.size.array as Float32Array;

    // Set initial positions, lifetimes, colors, and puff attributes
    for (let i = 0; i < count; i++) {
      positions.set([0, 0, 0], i * 3);
      lifetimes.current[i] = 0;
      colors.set(colorMap[0].color, i * 3);
      alphas[i] = 0;
      sizes[i] = 0;
    }

    // Mark attributes as needing update
    attributes.position.needsUpdate = true;
    attributes.color.needsUpdate = true;
    attributes.alpha.needsUpdate = true;
    attributes.size.needsUpdate = true;

    isInitialized.current = true; // Mark as initialized
  }, [count]);

  useFrame(() => {
    if (!particlesRef.current) return;

    // Update particle positions, velocities, lifetimes, colors, and puff attributes
    const { attributes } = particlesRef.current.geometry;
    const positions = attributes.position.array as Float32Array;
    const colors = attributes.color.array as Float32Array;
    const alphas = attributes.alpha.array as Float32Array;
    const sizes = attributes.size.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const idx = i * 3; // Index in the flat arrays (3 components per particle)

      if (lifetimes.current[i] <= 0) continue; // Skip dead particles

      // Update velocity with speed decay
      velocities.current[idx] *= speedDecay;
      velocities.current[idx + 1] *= speedDecay;
      velocities.current[idx + 2] *= speedDecay;

      // Update position based on velocity
      positions[idx] += velocities.current[idx];
      positions[idx + 1] += velocities.current[idx + 1];
      if (reverse) {
        positions[idx + 2] -= velocities.current[idx + 2];
      } else {
        positions[idx + 2] += velocities.current[idx + 2];
      }

      // Decrease lifetime
      lifetimes.current[i] = Math.max(0, lifetimes.current[i] - decaySpeed);

      // Update color based on lifetime (close/fast -> blue, slow/far -> red/cream)
      const [r, g, b] = getColorFromLifetime(
        lifetimes.current[i],
        colorMap,
        precomputedRanges,
      );
      colors.set([r, g, b], idx);

      // Puff grows ("blown out") as it ages, then fades out ("disperse")
      const age = 1 - lifetimes.current[i]; // 0 at spawn -> 1 at death
      const blowout = smoothstep(0, 0.3, age);
      const drift = age > 0.3 ? (age - 0.3) / 0.7 : 0;
      sizes[i] = BASE_SIZE * (0.5 + blowout * 0.9 + drift * 0.6);

      const fadeIn = smoothstep(0, 0.06, age);
      const fadeOut = 1 - smoothstep(0.4, 1, age);
      alphas[i] = fadeIn * fadeOut;

      // If lifetime is zero, reset position and hide the puff
      if (lifetimes.current[i] === 0) {
        positions.set([0, 0, 0], idx);
        colors.set([0, 0, 0], idx);
        alphas[i] = 0;
        sizes[i] = 0;
      }
    }

    // Generate new particle if active
    if (active) {
      // Set velocity for the new particle
      const idx = lastGeneratedIndex.current * 3;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.random() * coneAngle;

      velocities.current.set(
        [
          Math.sin(phi) * Math.cos(theta) * 0.2,
          Math.sin(phi) * Math.sin(theta) * 0.2,
          -Math.cos(phi) * 0.2,
        ],
        idx,
      );

      positions.set([0, 0, 0], idx);
      lifetimes.current[lastGeneratedIndex.current] = 1;
      attributes.rotation.array[lastGeneratedIndex.current] =
        Math.random() * Math.PI * 2;

      lastGeneratedIndex.current = (lastGeneratedIndex.current + 1) % count;
    }

    // Mark attributes as needing update
    attributes.position.needsUpdate = true;
    attributes.color.needsUpdate = true;
    attributes.alpha.needsUpdate = true;
    attributes.size.needsUpdate = true;
    attributes.rotation.needsUpdate = true;
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
          vertexShader={smokeVertexShader}
          fragmentShader={smokeFragmentShader}
          transparent
          depthWrite={false}
        />
      </points>
    </group>
  );
};

export default ParticleGenerator;
