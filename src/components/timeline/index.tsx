import Board from "./board";
import boardData from "./boardItems.json"; // Import the JSON data
import { boardJsonProps } from "../types/types";

/**
 * Validates a URL string.
 * @param url The string to validate.
 * @returns The URL string if valid, otherwise undefined.
 */
const getValidUrl = (url: unknown): string | undefined => {
  if (typeof url !== "string" || url.trim() === "") {
    return undefined;
  }
  try {
    new URL(url); // Throws an error if the URL is invalid
    return url;
  } catch {
    return undefined;
  }
};

/**
 * Processes raw board data, validating each item and providing fallbacks.
 * @param rawItems The array of items from the JSON file.
 * @returns A cleaned and validated array of board items.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processBoardData = (rawItems: any[]): boardJsonProps[] => {
  const seenIds = new Set<string>();

  return rawItems.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      console.warn(
        `Data at index ${index} is not a valid object. Creating placeholder.`,
      );
      return { id: `invalid-item-${index}` };
    }

    // 1. Validate ID for presence and uniqueness
    let finalId = item.id;
    if (
      typeof finalId !== "string" ||
      finalId.trim() === "" ||
      seenIds.has(finalId)
    ) {
      const originalId = finalId || "missing";
      finalId = `fallback-id-${index}`;
      console.warn(
        `Item at index ${index} has an invalid or duplicate ID ('${originalId}'). Using fallback: '${finalId}'.`,
      );
    }
    seenIds.add(finalId);

    // 2. Validate image path
    const finalImage =
      typeof item.image === "string" && item.image.trim() !== ""
        ? item.image
        : undefined;

    // 3. Validate link
    const finalLink = getValidUrl(item.link);

    // 4. Validate description
    const finalDescription =
      typeof item.description === "string" ? item.description : undefined;

    return {
      id: finalId,
      title: typeof item.title === "string" ? item.title : "Untitled",
      imagePath: finalImage,
      link: finalLink,
      description: finalDescription,
    };
  });
};

const Timeline = () => {
  let items: boardJsonProps[];

  try {
    if (
      boardData &&
      Array.isArray(boardData.boardItems) &&
      boardData.boardItems.length > 0
    ) {
      items = processBoardData(boardData.boardItems);
    } else {
      // If JSON is empty or malformed, throw to enter the catch block
      throw new Error("boardItems.json is empty or malformed.");
    }
  } catch (error) {
    console.warn(`${(error as Error).message} Using 5 fallback boards.`);
    items = Array.from({ length: 5 }, (_, i) => ({
      id: `fallback-${i}`,
      title: `Placeholder ${i + 1}`,
    }));
  }

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
