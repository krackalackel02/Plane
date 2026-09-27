import React from "react";
import { useEnvironment } from "../../context/envContext";
import { useScene } from "../../context/sceneContext";

// Ship sub-components
import Exhaust from "./exhaust"; // Exhaust effects component
import Body from "./body"; // Ship body model component (also fits shipRef's scale to the loaded model)
import Physics from "./physics"; // Physics and movement component
import ShipCollision from "./physics/collision"; // Boundary/board collision & bounce physics

const Ship: React.FC = () => {
  // bodyRef wraps just the ship model (not the exhaust flame, which would
  // otherwise balloon the debug bounding box every time it fires) - see
  // scene.tsx, which renders the "B"-hotkey bounding-box overlay for it
  // outside this group's transform.
  const { shipRef, bodyRef } = useScene();
  const { showShip } = useEnvironment(); // Get showShip from environment context

  if (!showShip) return null;

  return (
    showShip && (
      <>
        <group ref={shipRef}>
          <group ref={bodyRef}>
            <Body />
          </group>
          <Exhaust />
          <Physics />
          <ShipCollision />
        </group>
      </>
    )
  );
};

export default Ship;
