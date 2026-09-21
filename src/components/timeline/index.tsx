import Board from "./board";
import AutopilotHotkeys from "./autopilotHotkeys";
import { useProjects } from "../../context/projectContext";
import {
  calculatedBoardPositionsAndRotations,
  computeArcRadius,
} from "./calculatedBoardPositionsAndRotations";

/**
 * Timeline component for managing multiple boards
 * Renders a series of boards positioned along the z-axis
 * @returns JSX.Element
 */
const Timeline = () => {
  const { items } = useProjects();

  const boardsData = calculatedBoardPositionsAndRotations(items, "arc");
  const arcRadius = computeArcRadius(items.length);

  return (
    <>
      <group>
        {boardsData.map((board) => (
          <Board
            key={board.id}
            id={board.id}
            position={board.position}
            rotation={board.rotation} // Pass the calculated rotation to the Board
            helper={false}
            title={board.title}
            link={board.link}
            imagePath={board.imagePath}
            description={board.description}
            githubLink={board.githubLink}
            techStack={board.techStack}
            arcRadius={arcRadius}
          />
        ))}
      </group>
      <AutopilotHotkeys boards={boardsData} arcRadius={arcRadius} />
    </>
  );
};

export default Timeline;
