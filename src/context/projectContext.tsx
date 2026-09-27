import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  Dispatch,
  SetStateAction,
} from "react";
import { boardJsonProps } from "../components/types/boardTypes";
import { parseBoardItems } from "../components/timeline/parseBoardItems";
import boardData from "../components/timeline/boardItems.json";
import { E2E_TEST_HOOKS_ENABLED } from "../utils/e2eTestHooks";

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

  // Test-only hook so Playwright can activate a project's popup directly,
  // without having to fly the ship into its activation zone (see
  // src/context/keyContext.tsx for the same pattern with __activeKeys,
  // and src/utils/e2eTestHooks.ts for why). Never ships to the deployed
  // GitHub Pages bundle.
  useEffect(() => {
    if (E2E_TEST_HOOKS_ENABLED) {
      (
        window as unknown as {
          __setActiveProjectId?: Dispatch<SetStateAction<string | null>>;
        }
      ).__setActiveProjectId = setActiveProjectId;
    }
  }, []);

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
