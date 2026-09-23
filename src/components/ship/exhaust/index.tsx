import { useEffect } from "react";
import { useControlState } from "../../../context/keyContext"; // Import control state hook
import { useAutopilot } from "../../../context/autopilotContext";
import { audioEngine } from "../../../audio/audioEngine";

import Jet from "./jet"; // Import Jet component

const Exhaust: React.FC = () => {
  const rightJetPosition: [number, number, number] = [-0.5, 0.75, -0.5]; // Right position
  const leftJetPosition: [number, number, number] = [0.5, 0.75, -0.5]; // Left position
  const { direction, turn } = useControlState(); // Only consume exhaust state
  const { isFlying } = useAutopilot();

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
      />
      <Jet
        position={rightJetPosition}
        active={isRightJetActive}
        reverse={isReverse}
      />
    </>
  );
};

export default Exhaust;
