import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three";
const Body = () => {
  const { scene } = useGLTF("./models/ship.glb"); // Replace with your file path

  useEffect(() => {
    // Enable shadows on all meshes in the scene
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true; // Enable casting shadows
        child.receiveShadow = true; // Enable receiving shadows
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
};

export default Body;
