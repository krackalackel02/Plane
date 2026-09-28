import { useEffect, useRef } from "react";
import * as THREE from "three";
import anim from "./kframe.json";
import gsap from "gsap";
import { lookAtWithUp } from "./lookAtWithUp";
import { upOf } from "../../utils/planetSurface";
import { CameraModePreset } from "../../context/cameraModeContext";

const kframe = anim.frames;
const duration = 1.5;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Position/lookingAt pairs the flythrough tweens through in order, at
 * `duration` seconds per leg - kframe.json's own hand-tuned sweep, plus one
 * extra leg (added by animate() below) from wherever that sweep ends into
 * the player's actual current camera mode, so a mode other than "medium"
 * doesn't require its own bespoke intro.
 */
type Keyframe = { position: THREE.Vector3Tuple; lookingAt: THREE.Vector3Tuple };

const animate = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  ready: boolean,
  // Fires when the flythrough's last keyframe transition actually finishes
  // (the timeline's real GSAP onComplete) - not a fixed-duration estimate.
  // Anything that needs to wait for the camera to settle (e.g. the welcome
  // popup) should listen for this rather than guessing at a delay, since the
  // animation's own start time already shifts with `ready`.
  onComplete?: () => void,
  // The ship kframe.json's small lookingAt offsets are anchored to, and
  // whose own up (the local planet-surface normal) the roll is kept aligned
  // to via lookAtWithUp - a plain camera.lookAt() would roll against world
  // +Y instead, rendering the ship banked/rolled rather than level almost
  // everywhere on the sphere. Read live each update (not snapshotted) so it
  // stays correct even if the ship moves during the intro. Optional so
  // existing callers/tests that don't pass one keep the old world-origin,
  // world-up behavior.
  ship?: THREE.Object3D,
  // The player's current camera mode (see cameraModeContext) - the
  // flythrough's hand-tuned kframe.json sweep always ends at the same
  // point, so this appends one more leg from there to wherever that mode
  // actually settles (close/medium/max), rather than needing three
  // separate hand-tuned sweeps. Optional so existing callers/tests that
  // don't pass one just play the plain kframe.json sweep.
  finalTarget?: CameraModePreset,
) => {
  // The timeline-building effect below deliberately depends on neither of
  // these - it must only ever run once, when `ready` first flips true.
  // Picking a different camera mode later changes `finalTarget`'s identity
  // (a fresh preset object - see cameraModeContext), and including it in
  // the effect's deps would rebuild (and so replay, from the very start)
  // the whole intro sweep just because the player tapped the camera-mode
  // button well after it had already finished. Refs let the one-shot
  // effect still read whatever is current at the moment it actually
  // builds the timeline, without re-running when they change.
  const shipRef = useRef(ship);
  shipRef.current = ship;
  const finalTargetRef = useRef(finalTarget);
  finalTargetRef.current = finalTarget;

  useEffect(() => {
    if (!ready) return;

    const timeline = gsap.timeline({ repeat: 0, onComplete });
    const target = finalTargetRef.current;

    const frames: Keyframe[] = [
      ...kframe.map((frame) => ({
        position: [
          frame.position.x,
          frame.position.y,
          frame.position.z,
        ] as THREE.Vector3Tuple,
        lookingAt: [
          frame.lookingAt.x,
          frame.lookingAt.y,
          frame.lookingAt.z,
        ] as THREE.Vector3Tuple,
      })),
      ...(target
        ? [
            {
              position: [
                target.position.x,
                target.position.y,
                target.position.z,
              ] as THREE.Vector3Tuple,
              lookingAt: [
                target.lookingAt.x,
                target.lookingAt.y,
                target.lookingAt.z,
              ] as THREE.Vector3Tuple,
            },
          ]
        : []),
    ];

    frames.forEach((frame, index) => {
      // Calculate the start time for each frame transition
      const startTime = index * duration; // Assuming each transition takes 2 seconds

      // Animate camera position
      timeline.to(
        camera.position,
        {
          x: frame.position[0],
          y: frame.position[1],
          z: frame.position[2],
          duration: duration,
          ease: "linear", // Ensure a linear transition between frames
          onUpdate: () => camera.updateProjectionMatrix(),
        },
        startTime,
      );

      // Animate camera lookAt
      timeline.to(
        {},
        {
          duration: duration,
          onUpdate: () => {
            const currentShip = shipRef.current;
            const anchor = currentShip?.position ?? new THREE.Vector3();
            const worldUp = currentShip
              ? upOf(currentShip.quaternion)
              : WORLD_UP;
            const lookAt = anchor
              .clone()
              .add(new THREE.Vector3(...frame.lookingAt));
            lookAtWithUp(camera, lookAt, worldUp);
          },
          ease: "linear", // Sync the lookAt animation with the position animation
        },
        startTime,
      );
    });

    // Return a cleanup function to kill the timeline when the component unmounts
    return () => {
      timeline.kill();
    };
  }, [camera, ready, onComplete]);
};

export default animate;
