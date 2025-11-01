import Board from "./board";
import { useProjects } from "../../context/projectContext";
import { calculatedBoardPositionsAndRotations } from "./calculatedBoardPositionsAndRotations";

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
          title={board.title}
          link={board.link}
          imagePath={board.imagePath}
          description={board.description}
          githubLink={board.githubLink}
          techStack={board.techStack}
        />
      ))}
    </group>
  );
};

export default Timeline;
