import { useControlState } from "../../../context/keyContext";
import { log } from "../../../utils/common";
import Jet from "./jet";

const Exhaust: React.FC = () => {
  const rightJetPosition: [number, number, number] = [-0.5, 0.75, -0.5]; // Right position
  const leftJetPosition: [number, number, number] = [0.5, 0.75, -0.5]; // Left position
  const { direction, turn } = useControlState(); // Only consume exhaust state

  // Determine if jets are active based on direction and turn
  let isLeftJetActive =
    (direction !== "neutral" && turn != "left") || turn === "right";
  let isRightJetActive =
    (direction !== "neutral" && turn != "right") || turn === "left";

  const isReverse = direction === "backward";

  if (isReverse && turn !== "neutral") {
    isLeftJetActive = !isLeftJetActive;
    isRightJetActive = !isRightJetActive;
  }
  log(
    `[Render] [Exhaust] active prop is: ${isLeftJetActive} (left), ${isRightJetActive} (right)`,
  );
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
