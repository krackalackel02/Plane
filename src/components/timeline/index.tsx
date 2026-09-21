import Board from "./board";
import { useProjects } from "../../context/projectContext";
import { calculatedBoardPositionsAndRotations } from "./calculatedBoardPositionsAndRotations";

/**
 * Timeline component for managing multiple boards
 * Renders a series of boards positioned along the z-axis
 * @returns JSX.Element
 */
const Timeline = () => {
  const { items } = useProjects();

  const boardsData = calculatedBoardPositionsAndRotations(items, "arc");

  return (
    <group>
      {boardsData.map((board) => (
        <Board
          key={board.id}
          id={board.id}
          position={board.position}
          rotation={board.rotation} // Pass the calculated rotation to the Board
          helper={false}
          imagePath={board.imagePath}
        />
      ))}
    </group>
  );
};

export default Timeline;
