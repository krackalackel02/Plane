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
import animate from "./animate";
import { lookAtWithUp } from "./lookAtWithUp";
import { useEnvironment } from "../../context/envContext";
import { useScene } from "../../context/sceneContext";
import { useAutopilot } from "../../context/autopilotContext";
import { useLoading } from "../../context/loadingContext";
import { useCameraMode } from "../../context/cameraModeContext";
import { getActivePlanet } from "../../utils/planets";
import { upOf } from "../../utils/planetSurface";

// Disable react/prop-types for this file
/* eslint-disable react/prop-types */

// How far above the planet's actual ground the free-orbit camera is allowed
// to get, at minimum - OrbitControls has no notion of the sphere's
// geometry, so zooming in or dragging past the horizon would otherwise
// pull the camera straight through the solid planet.
const CAMERA_SURFACE_MARGIN = 3;

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
  const { ready, notifyIntroComplete } = useLoading();
  const { mode, preset } = useCameraMode();
  const { camera } = useThree();
  const reorientTween = useRef<gsap.core.Tween | null>(null);
  const isFirstModeRender = useRef(true);

  // Glides camera.position to a preset's local offset over `duration`
  // seconds, killing whatever tween (autopilot reorient or a mode switch)
  // was already running - the two are never meant to race each other, so
  // the most recent request always wins.
  const flyToPreset = (
    target: { x: number; y: number; z: number },
    duration: number,
  ) => {
    reorientTween.current?.kill();
    reorientTween.current = gsap.to(camera.position, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration,
      ease: "power2.inOut",
    });
  };

  // Mount-only: seeds the starting position for animate()'s intro flythrough
  // below. Must not rerun on every render - consuming isFlying (added
  // below) now causes a render right when autopilot engages, and a plain
  // camera.position.set() here would snap the camera before the reorient
  // tween even starts, defeating it. Reads whatever preset is active at
  // mount (the player's persisted camera-mode choice, or "medium" the
  // first time) rather than reacting to later mode switches - those are
  // handled by their own effect below instead, which tweens smoothly
  // rather than snapping.
  useEffect(() => {
    camera.position.set(
      preset.position.x,
      preset.position.y,
      preset.position.z,
    );
  }, [camera]);

  // Always plays, debug helper or not - the helper only adds the free-orbit
  // controls and the live position/lookingAt readout on top (see below), it
  // no longer replaces the intro. Ends with one extra leg (see animate.ts)
  // from kframe.json's own sweep into the player's actual current camera
  // mode, so a mode other than "medium" doesn't need its own bespoke intro.
  animate(
    camera,
    ready,
    notifyIntroComplete,
    shipRef.current ?? undefined,
    preset,
  );
  shipRef.current?.add(camera);

  // The player may have freely orbited the camera around while looking for
  // a board to click. Once autopilot actually engages, snap control back:
  // glide the camera back to the current camera mode's position (the same
  // local offset the intro animation ends on) so it settles in directly
  // behind the ship, facing forward, by the time it arrives -
  // camera.lookAt(shipRef...) below keeps it tracking the ship's own
  // rotation as it turns to face the destination, since the camera is a
  // child of the ship's group.
  useEffect(() => {
    if (!isFlying) return;
    flyToPreset(preset.position, 1.2);
    return () => {
      reorientTween.current?.kill();
    };
  }, [isFlying, camera]);

  // Picking a new camera mode from the HUD button (see cameraModeButton.tsx)
  // glides smoothly to it rather than snapping - skips the very first run,
  // since the mount effect above already seeds that same position instantly
  // before the intro even starts.
  useEffect(() => {
    if (isFirstModeRender.current) {
      isFirstModeRender.current = false;
      return;
    }
    flyToPreset(preset.position, 1.2);
  }, [mode]);

  useFrame(() => {
    const ship = shipRef.current;
    if (ship) {
      // Clamp the camera's actual world position outside the planet every
      // frame, regardless of how OrbitControls (or anything else) moved it -
      // simpler and more robust than trying to translate "stay above the
      // ground" into OrbitControls' own min-distance/polar-angle limits,
      // which would have to account for the ship's orientation constantly
      // changing as it moves around the sphere.
      const planet = getActivePlanet();
      const worldPosition = camera.getWorldPosition(new THREE.Vector3());
      const distanceFromCenter = worldPosition.distanceTo(planet.center);
      const minDistance = planet.radius + CAMERA_SURFACE_MARGIN;
      if (distanceFromCenter < minDistance) {
        const outward = worldPosition.clone().sub(planet.center).normalize();
        const corrected = outward
          .multiplyScalar(minDistance)
          .add(planet.center);
        camera.position.copy(ship.worldToLocal(corrected));
      }
      // Roll relative to the ship's own up (the local planet-surface
      // normal), not world +Y - see lookAtWithUp's doc comment for why a
      // plain camera.lookAt() here would render the ship banked/rolled
      // instead of level almost everywhere on the sphere.
      lookAtWithUp(camera, ship.position, upOf(ship.quaternion));
    }
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
