import Board from "./board";
import { useProjects } from "../../context/projectContext";

const Timeline = () => {
  const { items } = useProjects();

  // Number of boards is now determined by the data
  const boardCount = items.length;

  // Base position for the first board
  const basePosition: [number, number, number] = [4.0, 1.5, 0.5];

  // Offset between boards along the z-axis
  const offsetZ = 10.0;

  // Generate positions for the boards
  const boardPositions: [number, number, number][] = Array.from(
    { length: boardCount },
    (_, i) => [basePosition[0], basePosition[1], basePosition[2] + i * offsetZ],
  );
  return (
    <>
      {items.map((item, index) => (
        <Board
          key={item.id || index}
          id={item.id}
          position={boardPositions[index]} // Pass position from the generated array
          helper={false} // Disable helper controls
          // Pass the rest of the item data as props
          title={item.title}
          link={item.link}
          imagePath={item.imagePath}
          description={item.description}
        />
      ))}
    </>
  );
};

export default Timeline;
