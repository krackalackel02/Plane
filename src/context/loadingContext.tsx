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
  progress: number; // 0-100, eased toward the real completion ratio (see below)
}

const LoadingContext = createContext<LoadingContextValue>({
  ready: false,
  progress: 0,
});

// Caps how fast the displayed percentage is allowed to climb. three's
// LoadingManager only reports progress when an item *finishes* - on a local
// dev server every asset can finish within the same handful of milliseconds,
// so the real ratio jumps straight from 0 to 100 with no time in between for
// it to be seen climbing. This spreads that jump over real wall-clock time
// instead. On a genuinely slow load the real ratio climbs slower than this
// cap anyway, so it has no effect there - the bar just tracks real progress.
const DISPLAY_RATE_PER_SECOND = 130;

// If nothing ever starts loading (grace period below), treat it as already
// complete rather than waiting on progress that will never arrive.
const NOTHING_TO_LOAD_GRACE_MS = 400;

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
  const { active, loaded, total } = useProgress();
  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState(0);
  const [display, setDisplay] = useState(0);
  const targetRef = useRef(0);
  const startedRef = useRef(false);

  // The real, monotonic completion ratio. drei's own `progress` field
  // rescales its 0-100 baseline every time a new batch of assets starts
  // loading (e.g. board thumbnails kicking off after the ship model
  // finishes), which makes it visibly jump backwards - so this is derived
  // from the manager's raw cumulative counts instead, clamped so it can only
  // increase.
  useEffect(() => {
    if (active) startedRef.current = true;
    const raw = total > 0 ? (loaded / total) * 100 : 0;
    setTarget((prev) => Math.max(prev, raw));
  }, [active, loaded, total]);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  // Nothing ever started loading (e.g. everything was already resident) -
  // there's no real progress to report, so treat it as instantly complete.
  useEffect(() => {
    if (startedRef.current) return;
    const grace = setTimeout(() => {
      if (!startedRef.current) setTarget(100);
    }, NOTHING_TO_LOAD_GRACE_MS);
    return () => clearTimeout(grace);
  }, []);

  // Ease the DISPLAYED number toward the real target at a capped rate (see
  // DISPLAY_RATE_PER_SECOND above), driven by requestAnimationFrame so it's
  // tied to real time rather than React's render cadence.
  useEffect(() => {
    let raf: number;
    let last: number | null = null;

    const tick = (now: number) => {
      if (last === null) last = now;
      const dt = (now - last) / 1000;
      last = now;

      setDisplay((prev) => {
        const t = targetRef.current;
        if (prev >= t) return prev;
        return Math.min(t, prev + DISPLAY_RATE_PER_SECOND * dt);
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Ready once loading has actually finished AND the displayed number has
  // caught up to 100, so the splash never disappears mid-count.
  useEffect(() => {
    if (ready || active || display < 100) return;
    setReady(true);
  }, [active, display, ready]);

  // Safety net: never let the splash block the app forever if loading stalls.
  useEffect(() => {
    const hardStop = setTimeout(() => setReady(true), 15000);
    return () => clearTimeout(hardStop);
  }, []);

  return (
    <LoadingContext.Provider value={{ ready, progress: ready ? 100 : display }}>
      {children}
    </LoadingContext.Provider>
  );
};

/**
 * Reads the current asset-loading state from LoadingContext
 * @returns LoadingContextValue
 */
export const useLoading = () => useContext(LoadingContext);
