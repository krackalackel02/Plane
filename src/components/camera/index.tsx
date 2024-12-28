import {
  OrbitControls,
  PerspectiveCamera,
  FlyControls,
} from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect } from "react";
import "./camera.css";
import cameraPos from "../../utils/cameraPos.json";
// Disable react/prop-types for this file
/* eslint-disable react/prop-types */

interface CameraProps {
  helper?: boolean; // Optional boolean prop to control the helper display
  fly?: boolean; // Optional boolean prop to control the fly controls
}

const Camera: React.FC<CameraProps> = ({ helper = false, fly = false }) => {
  const { camera } = useThree();

  useEffect(() => {
    // Check if the JSON object exists and contains valid data
    if (cameraPos && cameraPos.position && cameraPos.lookingAt) {
      const { position, lookingAt } = cameraPos;
      // Set the initial camera position and look direction from JSON
      camera.position.set(position.x, position.y, position.z);
      camera.lookAt(lookingAt.x, lookingAt.y, lookingAt.z);
    } else {
      // Default values if JSON doesn't exist or is invalid
      camera.position.set(3.43, -0.09, 4.05);
      camera.lookAt(-0.68, 0.12, 0.72);
    }
  }, [camera]);

  useFrame(() => {
    if (!helper) return;

    const position = camera.position;
    const lookingAt = camera.getWorldDirection(new THREE.Vector3());

    const positionElement = document.getElementById("position");
    const lookingAtElement = document.getElementById("lookingAt");

    if (positionElement && lookingAtElement) {
      positionElement.innerText = `x: ${position.x.toFixed(2)}, y: ${position.y.toFixed(2)}, z: ${position.z.toFixed(2)}`;
      lookingAtElement.innerText = `x: ${lookingAt.x.toFixed(2)}, y: ${lookingAt.y.toFixed(2)}, z: ${lookingAt.z.toFixed(2)}`;
    }
  });

  return (
    <>
      {/* Perspective Camera */}
      <PerspectiveCamera makeDefault position={[0, 0, 3]} />
      {/* Controls */}
      {fly ? (
        <FlyControls autoForward={false} movementSpeed={10} rollSpeed={0.5} />
      ) : (
        <OrbitControls />
      )}
    </>
  );
};

export default Camera;
