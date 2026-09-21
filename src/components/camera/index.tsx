import {
  OrbitControls,
  PerspectiveCamera,
  FlyControls,
} from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import "./camera.css";
import cameraPos from "../../utils/cameraPos.json";
import animate from "./animate";
import { useEnvironment } from "../../context/envContext";
import { useScene } from "../../context/sceneContext";
import { useAutopilot } from "../../context/autopilotContext";

// Disable react/prop-types for this file
/* eslint-disable react/prop-types */

/**
 * Props for Camera component
 */
interface CameraProps {
  fly?: boolean; // Optional boolean prop to control the fly controls
}

/**
 * Camera component for 3D scene
 * @param fly - Whether to use fly controls
 * @returns JSX.Element
 */
const Camera: React.FC<CameraProps> = ({ fly = false }) => {
  const { shipRef } = useScene();
  const { showCameraHelper: helper } = useEnvironment();
  const { isFlying } = useAutopilot();
  const { camera } = useThree();
  const reorientTween = useRef<gsap.core.Tween | null>(null);

  // Mount-only: seeds the starting position for animate()'s intro flythrough
  // below. Must not rerun on every render - consuming isFlying (added
  // below) now causes a render right when autopilot engages, and a plain
  // camera.position.set() here would snap the camera before the reorient
  // tween even starts, defeating it.
  useEffect(() => {
    camera.position.set(
      cameraPos.position.x,
      cameraPos.position.y,
      cameraPos.position.z,
    );
  }, [camera]);

  if (!helper) animate(camera);
  shipRef.current?.add(camera);

  // The player may have freely orbited the camera around while looking for
  // a board to click. Once autopilot actually engages, snap control back:
  // glide the camera back to the canonical over-the-shoulder position (the
  // same local offset the intro animation ends on) so it settles in
  // directly behind the ship, facing forward, by the time it arrives -
  // camera.lookAt(shipRef...) below keeps it tracking the ship's own
  // rotation as it turns to face the destination, since the camera is a
  // child of the ship's group.
  useEffect(() => {
    if (!isFlying) return;

    reorientTween.current?.kill();
    reorientTween.current = gsap.to(camera.position, {
      x: cameraPos.position.x,
      y: cameraPos.position.y,
      z: cameraPos.position.z,
      duration: 1.2,
      ease: "power2.inOut",
    });

    return () => {
      reorientTween.current?.kill();
    };
  }, [isFlying, camera]);

  useFrame(() => {
    if (shipRef.current) camera.lookAt(shipRef.current.position);
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
        // FlyControls has no enabled prop - omit it entirely while flying
        // instead, so it can't fight the autopilot reorientation.
        !isFlying && (
          <FlyControls autoForward={false} movementSpeed={10} rollSpeed={0.5} />
        )
      ) : (
        <OrbitControls enabled={!isFlying} />
      )}
    </>
  );
};

export default Camera;
