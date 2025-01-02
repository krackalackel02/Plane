import React, { useEffect } from "react";
import { Group, Mesh, Object3DEventMap } from "three";
import { computeScale } from "../../utils/3d";
import Exhaust from "./exhaust/exhaust";
import Body from "./model/body";
import Physics from "./physics/physics";
import { useEnvironment } from "../../context/envContext";

const Ship: React.FC<{ shipRef: React.RefObject<Group<Object3DEventMap>> }> = ({
  shipRef,
}) => {
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
          <Physics groupRef={shipRef} />
        </group>
      </>
    )
  );
};

export default Ship;
