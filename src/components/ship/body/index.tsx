import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { useTrick } from "../../../context/trickContext";
import { useScene } from "../../../context/sceneContext";
import { computeScale } from "../../../utils/3d";
import shipParams from "../../../utils/shipParams.json";

// Target dimensions the loaded ship model is fit to (see computeScale) -
// shared with ShipCollision's own collision box (shipParams.json), so the
// two can never drift out of sync.
const SHIP_FIT_DIMENSIONS = {
  x: shipParams.halfExtents.x * 2,
  y: shipParams.halfExtents.y * 2,
  z: shipParams.halfExtents.z * 2,
};

const Body = () => {
  const { scene } = useGLTF("./models/ship.glb"); // Replace with your file path
  const { requestTrick } = useTrick();
  const { shipRef } = useScene();

  useEffect(() => {
    // Enable shadows on all meshes in the scene
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true; // Enable casting shadows
        child.receiveShadow = true; // Enable receiving shadows
      }
    });
  }, [scene]);

  // Fit the ship group's scale to the loaded model's own bounding box, read
  // once from the pristine GLTF scene itself (not the live shipRef group -
  // that also ends up holding exhaust particles and other non-model meshes
  // whose tiny bounding boxes would otherwise get picked up and blow the
  // scale factor way up depending on unrelated render timing).
  useEffect(() => {
    if (!shipRef.current) return;
    const bbox = new THREE.Box3().setFromObject(scene);
    const scaleFactor = computeScale(SHIP_FIT_DIMENSIONS, bbox);
    shipRef.current.scale.set(scaleFactor, scaleFactor, scaleFactor);
  }, [scene, shipRef]);

  // A tap/click on the ship triggers a barrel roll. This is a `click` (not
  // pointerdown), so a touch drag used to orbit the camera doesn't also
  // fire a trick - only a genuine tap does.
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    requestTrick();
  };

  return <primitive object={scene} onClick={handleClick} />;
};

export default Body;
