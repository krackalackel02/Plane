import { useEffect } from "react";
import { useControlState, useKeyContext } from "../../../context/keyContext"; // Import control state hook
import { useAutopilot } from "../../../context/autopilotContext";
import { useTrick } from "../../../context/trickContext";
import { audioEngine } from "../../../audio/audioEngine";
import { isBoostEngaged } from "../../../utils/boost";

import Jet from "./jet"; // Import Jet component

const Exhaust: React.FC = () => {
  const rightJetPosition: [number, number, number] = [-0.5, 0.75, -0.5]; // Right position
  const leftJetPosition: [number, number, number] = [0.5, 0.75, -0.5]; // Left position
  const { direction, turn } = useControlState(); // Only consume exhaust state
  const { isFlying } = useAutopilot();
  const activeKeys = useKeyContext();
  const { activeTrickDirection } = useTrick();

  // Determine if jets are active based on direction and turn
  let isLeftJetActive =
    (direction !== "neutral" && turn != "left") || turn === "right" || isFlying;
  let isRightJetActive =
    (direction !== "neutral" && turn != "right") || turn === "left" || isFlying;

  const isReverse = direction === "backward";

  if (isReverse && turn !== "neutral") {
    isLeftJetActive = !isLeftJetActive;
    isRightJetActive = !isRightJetActive;
  }

  // Boosting only reads as "boosting" while the jet firing it is actually
  // pushing the ship forward - not on reverse thrust or an idle jet - and
  // only while some real steering/throttle input is held alongside the
  // boost key (see isBoostEngaged).
  const isBoosting = isBoostEngaged(activeKeys) && !isReverse;

  // A barrel roll is driven by firing the jet opposite the roll direction
  // (more thrust on that side pushes the ship over) - flare it for the
  // trick's duration so the roll reads as jet-powered rather than sourceless.
  if (activeTrickDirection === 1) {
    isLeftJetActive = true;
  } else if (activeTrickDirection === -1) {
    isRightJetActive = true;
  }

  // Space-engine "wirr" hum tracks whether either jet is firing.
  const isEngineActive = isLeftJetActive || isRightJetActive;
  useEffect(() => {
    audioEngine.setEngineActive(isEngineActive);
  }, [isEngineActive]);
  useEffect(() => () => audioEngine.setEngineActive(false), []);

  return (
    <>
      <Jet
        position={leftJetPosition}
        active={isLeftJetActive}
        reverse={isReverse}
        boost={isBoosting && isLeftJetActive}
      />
      <Jet
        position={rightJetPosition}
        active={isRightJetActive}
        reverse={isReverse}
        boost={isBoosting && isRightJetActive}
      />
    </>
  );
};

export default Exhaust;
