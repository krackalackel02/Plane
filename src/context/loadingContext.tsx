import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useProgress } from "@react-three/drei";

/**
 * Shape of the value exposed by LoadingContext
 */
interface LoadingContextValue {
  ready: boolean; // Whether every tracked asset (GLTF models, textures) has finished loading
  progress: number; // 0-100 progress reported by three's DefaultLoadingManager
}

const LoadingContext = createContext<LoadingContextValue>({
  ready: false,
  progress: 0,
});

// Keep the splash on screen for at least this long so its animation gets to
// play even when everything loads from cache almost instantly.
const MIN_SPLASH_MS = 900;

/**
 * Tracks asset loading (three's DefaultLoadingManager, via drei's
 * useProgress) and exposes a single `ready` flag once loading has settled.
 * Consumed by the loading screen (to know when to fade out) and by the
 * camera (to know when it's safe to start the intro flythrough) so both stay
 * in sync off one source of truth.
 * @returns JSX.Element
 */
export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { active, progress } = useProgress();
  const [ready, setReady] = useState(false);
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    if (ready || active) return;

    const elapsed = Date.now() - mountedAtRef.current;
    const timer = setTimeout(
      () => setReady(true),
      Math.max(0, MIN_SPLASH_MS - elapsed),
    );

    return () => clearTimeout(timer);
  }, [active, ready]);

  // Safety net: never let the splash block the app forever if loading stalls.
  useEffect(() => {
    const hardStop = setTimeout(() => setReady(true), 15000);
    return () => clearTimeout(hardStop);
  }, []);

  return (
    <LoadingContext.Provider value={{ ready, progress }}>
      {children}
    </LoadingContext.Provider>
  );
};

/**
 * Reads the current asset-loading state from LoadingContext
 * @returns LoadingContextValue
 */
export const useLoading = () => useContext(LoadingContext);
