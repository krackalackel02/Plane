import React, {
  createContext,
  useContext,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { boardJsonProps } from "../components/types/types";
import boardData from "../components/timeline/boardItems.json";

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

// --- Context Definition ---
interface ProjectContextType {
  items: boardJsonProps[];
  activeID: string | null;
  setActiveID: Dispatch<SetStateAction<string | null>>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeID, setActiveID] = useState<string | null>(null);

  let items: boardJsonProps[];
  try {
    if (
      boardData &&
      Array.isArray(boardData.boardItems) &&
      boardData.boardItems.length > 0
    ) {
      items = processBoardData(boardData.boardItems);
    } else {
      throw new Error("boardItems.json is empty or malformed.");
    }
  } catch (error) {
    console.warn(`${(error as Error).message} Using 5 fallback boards.`);
    items = Array.from({ length: 5 }, (_, i) => ({
      id: `fallback-${i}`,
      title: `Placeholder ${i + 1}`,
    }));
  }

  return (
    <ProjectContext.Provider value={{ items, activeID, setActiveID }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjects must be used within a ProjectProvider");
  }
  return context;
};
