import { useControlState } from "../../../context/keyContext";
import Jet from "./jet";

const Exhaust: React.FC = () => {
  const right: [number, number, number] = [-0.5, 0.75, -0.5]; // Right position
  const left: [number, number, number] = [0.5, 0.75, -0.5]; // Left position
  const { direction, turn } = useControlState(); // Only consume exhaust state

  let leftJetActive =
    (direction !== "neutral" && turn != "left") || turn === "right";
  let rightJetActive =
    (direction !== "neutral" && turn != "right") || turn === "left";

  const reverse = direction === "backward";

  if (reverse && turn !== "neutral") {
    leftJetActive = !leftJetActive;
    rightJetActive = !rightJetActive;
  }

  return (
    <>
      <Jet position={left} active={leftJetActive} reverse={reverse} />
      <Jet position={right} active={rightJetActive} reverse={reverse} />
    </>
  );
};

export default Exhaust;
