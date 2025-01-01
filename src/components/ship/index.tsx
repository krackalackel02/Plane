import React, { useRef, useEffect } from "react";
import { Group, Mesh } from "three";
import { computeScale } from "../../utils/3d";
import Exhaust from "./exhaust/exhaust";
import Body from "./model/body";
import Physics from "./physics/physics";

const Ship: React.FC = () => {
  const groupRef = useRef<Group>(null);
  const scaleTo = { x: 5, y: 3, z: 2 }; // Scale the model to fit the scene

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
    <>
      <group ref={groupRef}>
        <Body />
        <Exhaust />
        <Physics groupRef={groupRef} />
      </group>
    </>
  );
};

export default Ship;
