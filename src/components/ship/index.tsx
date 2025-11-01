import React, { useEffect } from "react";
import { Mesh } from "three";
import { useEnvironment } from "../../context/envContext";
import { useScene } from "../../context/sceneContext";

// Utility to compute scale based on bounding box
import { computeScale } from "../../utils/3d";

// Ship sub-components
import Exhaust from "./exhaust"; // Exhaust effects component
import Body from "./body"; // Ship body model component
import Physics from "./physics"; // Physics and movement component

const Ship: React.FC = () => {
  const { shipRef } = useScene();
  const scaleTo = { x: 5, y: 3, z: 2 }; // Scale the model to fit the scene
  const { showShip } = useEnvironment(); // Get showShip from environment context

  if (!showShip) return null;

  // Scale the ship model based on its bounding box
  useEffect(() => {
    if (!shipRef.current) return;

    shipRef.current.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        mesh.geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox;
        if (bbox) {
          // Compute and set the scale factor
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
