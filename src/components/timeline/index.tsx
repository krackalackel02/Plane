import Board from "./board";
import AutopilotHotkeys from "./autopilotHotkeys";
import { useProjects } from "../../context/projectContext";
import {
  boardSideOffset,
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
        {boardsData.map((board, i) => (
          <Board
            key={board.id}
            id={board.id}
            position={board.position}
            quaternion={board.quaternion}
            helper={false}
            imagePath={board.imagePath}
            sideOffset={boardSideOffset(i)}
          />
        ))}
      </group>
      <AutopilotHotkeys boards={boardsData} />
    </>
  );
};

export default Timeline;
