import {
  OrbitControls,
  PerspectiveCamera,
  FlyControls,
} from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect } from "react";
import "./camera.css";

// Disable react/prop-types for this file
/* eslint-disable react/prop-types */

interface CameraProps {
  helper?: boolean; // Optional boolean prop to control the helper display
}

const Camera: React.FC<CameraProps> = ({ helper = false }) => {
  const { camera } = useThree();

  useEffect(() => {
    // Set the initial camera position and look direction
    camera.position.set(-1.74, 0.58, -2.94); // Position: x: -1.74, y: 0.58, z: -2.94
    camera.lookAt(0.66, 0.19, 0.73); // Looking At: x: 0.66, y: 0.19, z: 0.73
  }, [camera]);

  useFrame(() => {
    if (!helper) return;

    const position = camera.position;
    const lookingAt = camera.getWorldDirection(new THREE.Vector3());

    const positionElement = document.getElementById("position");
    const lookingAtElement = document.getElementById("lookingAt");

    if (positionElement && lookingAtElement) {
      positionElement.innerText = `Position: x: ${position.x.toFixed(2)}, y: ${position.y.toFixed(2)}, z: ${position.z.toFixed(2)}`;
      lookingAtElement.innerText = `Looking At: x: ${lookingAt.x.toFixed(2)}, y: ${lookingAt.y.toFixed(2)}, z: ${lookingAt.z.toFixed(2)}`;
    }
  });

  return (
    <>
      {/* Perspective Camera */}
      <PerspectiveCamera makeDefault position={[0, 0, 3]} />
      {/* Controls */}
      {helper ? (
        <FlyControls autoForward={false} movementSpeed={10} rollSpeed={0.5} />
      ) : (
        <OrbitControls />
      )}
    </>
  );
};

export default Camera;
