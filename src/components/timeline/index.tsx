import Board from "./board"; // Import Board component

/**
 * Timeline component for managing multiple boards
 * Renders a series of boards positioned along the z-axis
 * @returns JSX.Element
 */
const Timeline = () => {
  // Number of boards
  const boardCount = 5;

  // Base position for the first board
  const basePosition: [number, number, number] = [4.0, 2.5, 0.5];

  // Offset between boards along the x-axis
  const offsetZ = 10.0;

  // Generate positions for the boards
  const boardPositions: [number, number, number][] = Array.from(
    { length: boardCount },
    (_, i) => [basePosition[0], basePosition[1], basePosition[2] + i * offsetZ],
  );

  return (
    <>
      {boardPositions.map((boardPosition, boardIndex) => (
        <Board
          key={boardIndex}
          position={boardPosition} // Pass position prop
          helper={false} // Disable helper controls
        />
      ))}
    </>
  );
};

export default Timeline;
