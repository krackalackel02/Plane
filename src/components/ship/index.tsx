import React, { useRef } from "react";
import type { Group } from "three";
import { useEnvironment } from "../../context/envContext";
import { useScene } from "../../context/sceneContext";

// Ship sub-components
import Exhaust from "./exhaust"; // Exhaust effects component
import Body from "./body"; // Ship body model component (also fits shipRef's scale to the loaded model)
import Physics from "./physics"; // Physics and movement component
import ShipCollision from "./physics/collision"; // Board collision & bounce physics

const Ship: React.FC = () => {
  // bodyRef wraps just the ship model (not the exhaust flame, which would
  // otherwise balloon the debug bounding box every time it fires) - see
  // scene.tsx, which renders the "B"-hotkey bounding-box overlay for it
  // outside this group's transform.
  const { shipRef, bodyRef } = useScene();
  const { showShip } = useEnvironment(); // Get showShip from environment context
  // The ship's attitude - pitch, banking into turns, the barrel-roll trick -
  // turns the body and its exhaust only. shipRef itself carries just
  // position and heading: the chase camera rides on it as a child, so a roll
  // spins the ship on its own axis in a still view instead of swinging the
  // camera, and the whole planet with it, around the ship.
  const attitudeRef = useRef<Group>(null);

  if (!showShip) return null;

  return (
    showShip && (
      <>
        <group ref={shipRef}>
          <group ref={attitudeRef}>
            <group ref={bodyRef}>
              <Body />
            </group>
            <Exhaust />
          </group>
          <Physics attitudeRef={attitudeRef} />
          <ShipCollision />
        </group>
      </>
    )
  );
};

export default Ship;
