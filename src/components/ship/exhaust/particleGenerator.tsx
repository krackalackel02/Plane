import React, { useRef, useEffect } from "react";
import { Points } from "three";
import { useFrame } from "@react-three/fiber";

// Utilities for particle color and range computations
import { precomputeRanges, getColorFromLifetime } from "../../../utils/3d";
import { ColorMapEntry, Range } from "../../types/types";

const colorMap: ColorMapEntry[] = [
  { limit: 1, color: [0, 0, 1] }, // Blue
  { limit: 0.9, color: [1, 0, 0] }, // Red
  { limit: 0.5, color: [1, 1, 0] }, // Yellow
];

// Precompute ranges for color interpolation
const precomputedRanges: Range[] = precomputeRanges(colorMap);

/**
 * ParticleGenerator component to create and manage exhaust particles.
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

  // Initialize particle positions and colors
  useEffect(() => {
    if (isInitialized.current) return; // Prevent re-initialization
    if (!particlesRef.current) return; // Ensure the ref is set

    // Initialize particle positions and colors
    const positions = particlesRef.current.geometry.attributes.position
      .array as Float32Array;
    const colors = particlesRef.current.geometry.attributes.color
      .array as Float32Array;

    // Set initial positions, lifetimes, and colors
    for (let i = 0; i < count; i++) {
      positions.set([0, 0, 0], i * 3);
      lifetimes.current[i] = 0;
      colors.set(colorMap[0].color, i * 3);
    }

    // Mark attributes as needing update
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    particlesRef.current.geometry.attributes.color.needsUpdate = true;

    isInitialized.current = true; // Mark as initialized
  }, [count]);

  useFrame(() => {
    if (!particlesRef.current) return;

    // Update particle positions, velocities, lifetimes, and colors
    const positions = particlesRef.current.geometry.attributes.position
      .array as Float32Array;
    const colors = particlesRef.current.geometry.attributes.color
      .array as Float32Array;

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

      // Update color based on lifetime
      const [r, g, b] = getColorFromLifetime(
        lifetimes.current[i],
        colorMap,
        precomputedRanges,
      );
      colors.set([r, g, b], idx);

      // If lifetime is zero, reset position and color
      if (lifetimes.current[i] === 0) {
        positions.set([0, 0, 0], idx);
        colors.set([0, 0, 0], idx);
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

      lastGeneratedIndex.current = (lastGeneratedIndex.current + 1) % count;
    }

    // Mark attributes as needing update
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    particlesRef.current.geometry.attributes.color.needsUpdate = true;
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

export default ParticleGenerator;
