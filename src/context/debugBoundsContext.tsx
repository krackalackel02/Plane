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

// Vite's DEV flag is tied to the command (serve vs build), not --mode - a
// production bundle (`vite build`, what .github/workflows/main.yaml ships
// to GitHub Pages) is always DEV=false regardless of how it was built. So
// this gate, unlike `showBounds` below, can't be flipped on by anything a
// deployed site's visitor could do (pressing "B", or setting localStorage
// via devtools) - only by a dev actually running `vite`/`vite dev`, or by
// someone deliberately building with VITE_SHOW_BOUNDS=true (same opt-in
// convention as VITE_INCLUDE_SANDBOX in vite.config.ts).
const canActivate = import.meta.env.DEV;

// Lets the "B" hotkey toggle wireframe bounding boxes around debuggable
// objects (ship, boards, ...) live, without needing VITE_SHOW_BOUNDS + a
// reload. Falls back to that env var only the first time, before the
// player has ever toggled it themselves - mirrors ExhaustModeProvider's
// localStorage-over-env pattern.
export const DebugBoundsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { showBounds } = useEnvironment();
  const toggleAllowed = canActivate || showBounds;
  const [enabled, setEnabled] = useState<boolean>(
    () => toggleAllowed && (readStoredEnabled() ?? showBounds),
  );

  const toggle = useCallback(() => {
    if (!toggleAllowed) return;
    setEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, [toggleAllowed]);

  useEffect(() => {
    // Never even attaches the listener on a real production build (no
    // VITE_SHOW_BOUNDS override baked in) - a deployed site's visitor has
    // no way to switch this overlay on, not even via localStorage.
    if (!toggleAllowed) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const targetTag = (event.target as HTMLElement | null)?.tagName;
      if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;
      toggle();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleAllowed, toggle]);

  return (
    <DebugBoundsContext.Provider value={{ enabled, toggle }}>
      {children}
    </DebugBoundsContext.Provider>
  );
};

export const useDebugBounds = () => useContext(DebugBoundsContext);
