import Board from "./board";
import AutopilotHotkeys from "./autopilotHotkeys";
import { useProjects } from "../../context/projectContext";
import { calculatedBoardPositionsAndRotations } from "./calculatedBoardPositionsAndRotations";

/**
 * Timeline component for managing multiple boards.
 *
 * Each board stands in open water beside the trail, facing back along the
 * ship's line of approach, with its activation mat on the trail in front of
 * it (see calculatedBoardPositionsAndRotations for how both are chosen).
 * @returns JSX.Element
 */
const Timeline = () => {
  const { items } = useProjects();

  const boardsData = calculatedBoardPositionsAndRotations(items);

  return (
    <>
      <group>
        {boardsData.map((board) => (
          <Board
            key={board.id}
            id={board.id}
            position={board.position}
            quaternion={board.quaternion}
            matPosition={board.matPosition}
            matQuaternion={board.matQuaternion}
            helper={false}
            imagePath={board.imagePath}
          />
        ))}
      </group>
      <AutopilotHotkeys boards={boardsData} />
    </>
  );
};

export default Timeline;
