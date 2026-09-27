import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useEnvironment } from "./envContext";

const STORAGE_KEY = "plane:debug-bounds";

interface DebugBoundsContextType {
  enabled: boolean;
  toggle: () => void;
}

const DebugBoundsContext = createContext<DebugBoundsContextType>({
  enabled: false,
  toggle: () => {},
});

const readStoredEnabled = (): boolean | null => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return null;
};

// Lets the "B" hotkey toggle wireframe bounding boxes around debuggable
// objects (ship, boards, ...) live, without needing VITE_SHOW_BOUNDS + a
// reload. Falls back to that env var only the first time, before the
// player has ever toggled it themselves - mirrors ExhaustModeProvider's
// localStorage-over-env pattern.
export const DebugBoundsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { showBounds } = useEnvironment();
  const [enabled, setEnabled] = useState<boolean>(
    () => readStoredEnabled() ?? showBounds,
  );

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const targetTag = (event.target as HTMLElement | null)?.tagName;
      if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;
      toggle();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return (
    <DebugBoundsContext.Provider value={{ enabled, toggle }}>
      {children}
    </DebugBoundsContext.Provider>
  );
};

export const useDebugBounds = () => useContext(DebugBoundsContext);
