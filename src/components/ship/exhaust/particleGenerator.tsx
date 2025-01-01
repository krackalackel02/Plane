import React, { useRef, useEffect } from "react";
import { Points } from "three";
import { useFrame } from "@react-three/fiber";
import {
  ColorMapEntry,
  Range,
  precomputeRanges,
  getColorFromLifetime,
} from "../../../utils/3d";

const colorMap: ColorMapEntry[] = [
  { limit: 1, color: [0, 0, 1] },
  { limit: 0.9, color: [1, 0, 0] },
  { limit: 0.5, color: [1, 1, 0] },
];

const precomputedRanges: Range[] = precomputeRanges(colorMap);

interface ParticleGeneratorProps {
  active: boolean;
  position: [number, number, number];
  count?: number;
  coneAngle?: number;
  decaySpeed?: number;
  speedDecay?: number;
}

const ParticleGenerator: React.FC<ParticleGeneratorProps> = ({
  active,
  position,
  count = 100,
  coneAngle = Math.PI / 6,
  decaySpeed = 0.01,
  speedDecay = 0.98,
}) => {
  const particlesRef = useRef<Points>(null);
  const velocities = useRef<Float32Array>(new Float32Array(count * 3));
  const lifetimes = useRef<Float32Array>(new Float32Array(count));
  const lastGeneratedIndex = useRef(0);
  const isInitialized = useRef(false);

  const initializeParticles = () => {
    if (!particlesRef.current) return;

    const positions = particlesRef.current.geometry.attributes.position
      .array as Float32Array;
    const colors = particlesRef.current.geometry.attributes.color
      .array as Float32Array;

    for (let i = 0; i < count; i++) {
      positions.set([0, 0, 0], i * 3);
      lifetimes.current[i] = 0;
      colors.set(colorMap[0].color, i * 3);
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    particlesRef.current.geometry.attributes.color.needsUpdate = true;
    isInitialized.current = true;
  };

  useEffect(() => {
    if (!isInitialized.current && particlesRef.current) {
      initializeParticles();
    }
  }, [count]);

  useFrame(() => {
    if (!particlesRef.current) return;

    const positions = particlesRef.current.geometry.attributes.position
      .array as Float32Array;
    const colors = particlesRef.current.geometry.attributes.color
      .array as Float32Array;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;

      if (lifetimes.current[i] > 0) {
        velocities.current[idx] *= speedDecay;
        velocities.current[idx + 1] *= speedDecay;
        velocities.current[idx + 2] *= speedDecay;

        positions[idx] += velocities.current[idx];
        positions[idx + 1] += velocities.current[idx + 1];
        positions[idx + 2] += velocities.current[idx + 2];

        lifetimes.current[i] = Math.max(0, lifetimes.current[i] - decaySpeed);

        const [r, g, b] = getColorFromLifetime(
          lifetimes.current[i],
          colorMap,
          precomputedRanges,
        );
        colors.set([r, g, b], idx);

        if (lifetimes.current[i] === 0) {
          positions.set([0, 0, 0], idx);
          colors.set([0, 0, 0], idx);
        }
      }
    }

    if (active) {
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
