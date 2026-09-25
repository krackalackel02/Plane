import { useControlState, useKeyContext } from "../../../context/keyContext"; // Import control state hook
import { useAutopilot } from "../../../context/autopilotContext";
import keys from "../../../utils/keys.json";

import Jet from "./jet"; // Import Jet component

const Exhaust: React.FC = () => {
  const rightJetPosition: [number, number, number] = [-0.5, 0.75, -0.5]; // Right position
  const leftJetPosition: [number, number, number] = [0.5, 0.75, -0.5]; // Left position
  const { direction, turn } = useControlState(); // Only consume exhaust state
  const { isFlying } = useAutopilot();
  const activeKeys = useKeyContext();

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
  // pushing the ship forward - not on reverse thrust or an idle jet.
  const isBoosting = activeKeys.has(keys.boost) && !isReverse;

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
