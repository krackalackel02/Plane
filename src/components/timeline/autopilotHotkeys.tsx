import { useEffect } from "react";
import { Vector3 } from "three";
import { useAutopilot } from "../../context/autopilotContext";
import { useScene } from "../../context/sceneContext";
import { getBoardMatWorldPosition } from "../../utils/3d";

/* eslint-disable react/prop-types */
interface AutopilotHotkeysProps {
  boards: {
    position: [number, number, number];
    rotation: [number, number, number];
  }[];
  arcRadius: number;
}

// Side-effect-only component: "0" flies to the origin, "1"-"9" fly to the
// Nth board. Deliberately a standalone window listener rather than wired
// into keyContext's WASD/arrow system - digits are unused there, and mixing
// this concern into the movement-key set would blur two different kinds of
// input.
const AutopilotHotkeys: React.FC<AutopilotHotkeysProps> = ({
  boards,
  arcRadius,
}) => {
  const { requestAutopilot } = useAutopilot();
  const { shipRef } = useScene();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!/^[0-9]$/.test(event.key)) return;

      if (event.key === "0") {
        const y = shipRef.current?.position.y ?? 0;
        requestAutopilot(new Vector3(0, y, 0), arcRadius);
        return;
      }

      const board = boards[Number(event.key) - 1];
      if (!board) return;
      requestAutopilot(
        getBoardMatWorldPosition(board.position, board.rotation[1]),
        arcRadius,
      );
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [boards, arcRadius, requestAutopilot, shipRef]);

  return null;
};

export default AutopilotHotkeys;
