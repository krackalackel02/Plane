import { useEffect } from "react";
import * as THREE from "three";
import anim from "./kframe.json";
import gsap from "gsap";
const kframe = anim.frames;
const duration = 1.5;

// Total wall-clock length of the intro flythrough - kept here (rather than
// re-derived where it's needed) so anything that has to wait for the camera
// to settle, e.g. the welcome popup, can't drift out of sync if the
// keyframe count or per-frame duration ever changes.
export const INTRO_ANIMATION_DURATION_MS = kframe.length * duration * 1000;

const animate = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
) => {
  useEffect(() => {
    const timeline = gsap.timeline({ repeat: 0 });

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
  }, [camera]);
};

export default animate;
