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
import gsap from "gsap";
import anim from "./kframe.json";
const kframe = anim.frames;

// Disable react/prop-types for this file
/* eslint-disable react/prop-types */

interface CameraProps {
  helper?: boolean; // Optional boolean prop to control the helper display
  fly?: boolean; // Optional boolean prop to control the fly controls
}

const animate = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
) => {
  useEffect(() => {
    const timeline = gsap.timeline({ repeat: 0, repeatDelay: 1 });

    kframe.forEach((frame, index) => {
      // Animate camera position
      timeline.to(camera.position, {
        x: frame.position.x,
        y: frame.position.y,
        z: frame.position.z,
        duration: 2,
        ease: "power2.out",
        onUpdate: () => camera.updateProjectionMatrix(),
      });

      // Animate camera lookAt
      timeline.to(
        {},
        {
          duration: 2,
          onUpdate: () => {
            const lookAt = new THREE.Vector3(
              frame.lookingAt.x,
              frame.lookingAt.y,
              frame.lookingAt.z,
            );
            camera.lookAt(lookAt);
          },
        },
        index * 2, // Sync lookAt with position animation
      );
    });

    // Return a cleanup function that stops the timeline
    return () => {
      timeline.kill();
    };
  }, [camera]);
};

const Camera: React.FC<CameraProps> = ({ helper = false, fly = false }) => {
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
