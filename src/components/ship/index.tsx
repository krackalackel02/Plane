import React, { useRef, useState, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { Group, Mesh } from "three";
import { computeScale } from "../../utils/3d";
import { Motion } from "./motion";
import ParticleGenerator from "./particleGenerator";

const Ship: React.FC = () => {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF("./models/ship.glb"); // Replace with your file path
  const scaleTo = { x: 5, y: 3, z: 2 }; // Scale the model to fit the scene
  // Initialize motions
  const rollMotion = new Motion({
    axis: "z",
    stiffness: 50,
    damping: 4,
    maxAngle: Math.PI / 6,
    positiveKey: "ArrowLeft",
    negativeKey: "ArrowRight",
  });

  const pitchMotion = new Motion({
    axis: "x",
    stiffness: 50,
    damping: 4,
    maxAngle: Math.PI / 12,
    positiveKey: "ArrowDown",
    negativeKey: "ArrowUp",
  });

  const [particlesActive, setParticlesActive] = useState(false); // Track particle generator state

  useEffect(() => {
    if (!groupRef.current) return;

    rollMotion.attachTo(groupRef.current);
    pitchMotion.attachTo(groupRef.current);

    const handleKeyDown = (e: KeyboardEvent) => {
      rollMotion.handleKeyDown(e);
      pitchMotion.handleKeyDown(e);

      if (e.key === " ") {
        setParticlesActive(true); // Activate particles on Spacebar
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      rollMotion.handleKeyUp(e);
      pitchMotion.handleKeyUp(e);

      if (e.key === " ") {
        setParticlesActive(false); // Deactivate new particle generation
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);

      rollMotion.cleanup();
      pitchMotion.cleanup();
    };
  }, []);

  // Bounding box and scale computation
  useEffect(() => {
    if (!groupRef.current) return;

    groupRef.current.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        mesh.geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox;
        if (bbox) {
          const scaleFactor = computeScale(scaleTo, bbox);
          groupRef.current?.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }
      }
    });
  }, [scaleTo]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
      {/* Add ParticleGenerator at the exhaust position */}
      <ParticleGenerator
        active={particlesActive}
        position={[0.5, 0.75, -0.5]}
        count={100}
      />
      <ParticleGenerator
        active={particlesActive}
        position={[-0.5, 0.75, -0.5]}
        count={100}
      />
    </group>
  );
};

export default Ship;
