import Board from "./board";
import AutopilotHotkeys from "./autopilotHotkeys";
import { useProjects } from "../../context/projectContext";
import { calculatedBoardPositionsAndRotations } from "./calculatedBoardPositionsAndRotations";

/**
 * Timeline component for managing multiple boards.
 *
 * Each board stands at its own stop - a patch of open water searched out by
 * calculatedBoardPositionsAndRotations - with its activation zone in front of
 * it, facing the ship's line of approach. The board renders at the same
 * anchor as its zone (as on main) rather than offset off to one side: the
 * trail turns a right angle at the zone, so the ship never carries on into
 * the board behind it.
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
