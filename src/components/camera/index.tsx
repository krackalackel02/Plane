import {
  OrbitControls,
  PerspectiveCamera,
  FlyControls,
} from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import "./camera.css";
import cameraPos from "../../utils/cameraPos.json";
import animate from "./animate";
import { useEnvironment } from "../../context/envContext";

// Disable react/prop-types for this file
/* eslint-disable react/prop-types */

interface CameraProps {
  fly?: boolean; // Optional boolean prop to control the fly controls
}

const Camera: React.FC<CameraProps> = ({ fly = false }) => {
  const { showCameraHelper: helper } = useEnvironment();
  const { camera } = useThree();
  camera.position.set(
    cameraPos.position.x,
    cameraPos.position.y,
    cameraPos.position.z,
  );
  animate(camera);

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
