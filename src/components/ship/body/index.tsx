import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { useTrick } from "../../../context/trickContext";

const Body = () => {
  const { scene } = useGLTF("./models/ship.glb"); // Replace with your file path
  const { requestTrick } = useTrick();

  useEffect(() => {
    // Enable shadows on all meshes in the scene
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true; // Enable casting shadows
        child.receiveShadow = true; // Enable receiving shadows
      }
    });
  }, [scene]);

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
