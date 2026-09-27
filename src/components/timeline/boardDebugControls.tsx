import { useControls } from "leva";
import { BoardParams } from "../types/boardTypes";
import { createSaveButton } from "../../utils/debugSaveButton";

interface BoardDebugControlsProps {
  params: BoardParams;
  updateParam: (key: keyof BoardParams) => (value: number) => void;
}

// Leva panel for tuning board dimensions live. Split into its own
// lazy-loaded chunk (see board.tsx) so leva - never used outside this
// debug path - doesn't ship in the main bundle.
const BoardDebugControls = ({
  params,
  updateParam,
}: BoardDebugControlsProps) => {
  const createControl = (
    key: keyof BoardParams,
    min: number,
    max: number,
    step: number,
  ) => ({
    value: params[key],
    min,
    max,
    step,
    onChange: updateParam(key),
  });

  useControls(
    {
      outerX: createControl("outerX", 1, 10, 0.1),
      outerY: createControl("outerY", 1, 10, 0.1),
      outerZ: createControl("outerZ", 0.1, 2, 0.05),
      frame: createControl("frame", 0.1, 2, 0.05),
      depth: createControl("depth", 0.1, 1, 0.05),
      Save: createSaveButton(params, "boardParams.json"),
    },
    [params],
  );

  return null;
};

export default BoardDebugControls;
