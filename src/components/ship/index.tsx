import React, { useEffect } from "react";
import { Mesh } from "three";
import { computeScale } from "../../utils/3d";
import Exhaust from "./exhaust";
import Body from "./body";
import Physics from "./physics";
import { useEnvironment } from "../../context/envContext";
import { useScene } from "../../context/sceneContext";

const Ship: React.FC = () => {
  const { shipRef } = useScene();
  const scaleTo = { x: 5, y: 3, z: 2 }; // Scale the model to fit the scene
  const { showShip } = useEnvironment();

  // Bounding box and scale computation
  useEffect(() => {
    if (!shipRef.current) return;

    shipRef.current.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        mesh.geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox;
        if (bbox) {
          const scaleFactor = computeScale(scaleTo, bbox);
          shipRef.current?.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }
      }
    });
  }, [scaleTo]);

  return (
    showShip && (
      <>
        <group ref={shipRef}>
          <Body />
          <Exhaust />
          <Physics />
        </group>
      </>
    )
  );
};

export default Ship;
