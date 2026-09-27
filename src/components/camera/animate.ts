import { useEffect } from "react";
import * as THREE from "three";
import anim from "./kframe.json";
import gsap from "gsap";
const kframe = anim.frames;
const duration = 1.5;

const animate = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  ready: boolean,
  // Fires when the flythrough's last keyframe transition actually finishes
  // (the timeline's real GSAP onComplete) - not a fixed-duration estimate.
  // Anything that needs to wait for the camera to settle (e.g. the welcome
  // popup) should listen for this rather than guessing at a delay, since the
  // animation's own start time already shifts with `ready`.
  onComplete?: () => void,
) => {
  useEffect(() => {
    if (!ready) return;

    const timeline = gsap.timeline({ repeat: 0, onComplete });

    kframe.forEach((frame, index) => {
      // Calculate the start time for each frame transition
      const startTime = index * duration; // Assuming each transition takes 2 seconds

      // Animate camera position
      timeline.to(
        camera.position,
        {
          x: frame.position.x,
          y: frame.position.y,
          z: frame.position.z,
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
            const lookAt = new THREE.Vector3(
              frame.lookingAt.x,
              frame.lookingAt.y,
              frame.lookingAt.z,
            );
            camera.lookAt(lookAt);
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
