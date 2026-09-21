import React, {
  createContext,
  useContext,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { boardJsonProps } from "../components/types/boardTypes";
import { parseBoardItems } from "../components/timeline/parseBoardItems";
import boardData from "../components/timeline/boardItems.json";

// --- Context Definition ---
interface ProjectContextType {
  items: boardJsonProps[];
  activeProjectId: string | null;
  setActiveProjectId: Dispatch<SetStateAction<string | null>>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  let items: boardJsonProps[];
  try {
    if (
      boardData &&
      Array.isArray(boardData.boardItems) &&
      boardData.boardItems.length > 0
    ) {
      items = parseBoardItems(boardData.boardItems);
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
    <ProjectContext.Provider
      value={{ items, activeProjectId, setActiveProjectId }}
    >
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
