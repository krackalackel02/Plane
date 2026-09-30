import Board from "./board";
import AutopilotHotkeys from "./autopilotHotkeys";
import { useProjects } from "../../context/projectContext";
import {
  boardVisualTransform,
  calculatedBoardPositionsAndRotations,
} from "./calculatedBoardPositionsAndRotations";

/**
 * Timeline component for managing multiple boards
 * Renders a series of boards spaced evenly around the planet's equator,
 * alternating left/right of the trail so the centerline itself - where the
 * ship flies and each board's activation zone sits - stays clear.
 * @returns JSX.Element
 */
const Timeline = () => {
  const { items } = useProjects();

  const boardsData = calculatedBoardPositionsAndRotations(items);

  return (
    <>
      <group>
        {boardsData.map((board, i) => {
          const visual = boardVisualTransform(board, i);
          return (
            <Board
              key={board.id}
              id={board.id}
              position={board.position}
              quaternion={board.quaternion}
              visualPosition={visual.position}
              visualQuaternion={visual.quaternion}
              helper={false}
              imagePath={board.imagePath}
            />
          );
        })}
      </group>
      <AutopilotHotkeys boards={boardsData} />
    </>
  );
};

export default Timeline;
