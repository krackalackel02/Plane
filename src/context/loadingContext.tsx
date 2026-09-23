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
  progress: number; // 0-100, see the climb/finish curve described below
}

const LoadingContext = createContext<LoadingContextValue>({
  ready: false,
  progress: 0,
});

// three's LoadingManager only reports progress when an item *finishes*, not
// as bytes arrive, so it can't drive a smooth bar on its own - on a fast/
// local/cached load every asset can finish within the same tick, and on a
// slow one there's just one or two big jumps. Instead, assume loading takes
// about this long and climb toward 99% over that time; if it's not actually
// done yet, hold at 99% until it is, then snap the rest of the way to 100.
const AVG_LOAD_MS = 1000;
const HOLD_AT_PERCENT = 99;

// Once assets are actually done, animate the remaining distance to 100 over
// this long instead of an abrupt cut.
const FINISH_SPIN_MS = 220;

// If nothing ever starts loading (e.g. everything was already resident),
// treat it as done after this grace period rather than waiting forever.
const NOTHING_TO_LOAD_GRACE_MS = 400;

// Assets that only get requested once something else finishes loading first
// (e.g. a board's shared material textures live behind its own thumbnail
// texture in the component tree, so they don't get requested until that
// thumbnail's Suspense boundary resolves) mean the manager can look
// momentarily idle between waves rather than only once at the very end.
// Require it to stay idle for this long, with nothing new starting, before
// treating loading as actually finished.
const SETTLE_MS = 200;

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
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);
  const doneRef = useRef(false);

  // Assets are actually done once the manager has both started and settled -
  // i.e. gone idle and STAYED idle for SETTLE_MS, rather than merely looking
  // idle for one snapshot (see SETTLE_MS above for why: loading happens in
  // waves here, not one flat burst). If a new wave starts before the timer
  // fires, this effect reruns with active=true, and React's effect-cleanup
  // ordering cancels the pending timer automatically before that happens.
  useEffect(() => {
    if (active) startedRef.current = true;

    if (!active && startedRef.current && total > 0 && loaded >= total) {
      const timer = setTimeout(() => {
        doneRef.current = true;
      }, SETTLE_MS);
      return () => clearTimeout(timer);
    }
  }, [active, loaded, total]);

  // Nothing ever started loading - there's no real progress to wait on.
  useEffect(() => {
    if (startedRef.current) return;
    const grace = setTimeout(() => {
      if (!startedRef.current) doneRef.current = true;
    }, NOTHING_TO_LOAD_GRACE_MS);
    return () => clearTimeout(grace);
  }, []);

  // Drives the whole climb/finish curve off requestAnimationFrame, tied to
  // real wall-clock time rather than React's render cadence.
  useEffect(() => {
    let raf: number;
    let current = 0;
    let startTime: number | null = null;
    let finishStartTime: number | null = null;
    let finishFrom = 0;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;

      if (!doneRef.current) {
        const t = Math.min(1, (now - startTime) / AVG_LOAD_MS);
        current = t * HOLD_AT_PERCENT;
        setDisplay(current);
        raf = requestAnimationFrame(tick);
        return;
      }

      if (finishStartTime === null) {
        finishStartTime = now;
        finishFrom = current;
      }

      const t = Math.min(1, (now - finishStartTime) / FINISH_SPIN_MS);
      current = finishFrom + (100 - finishFrom) * t;
      setDisplay(current);

      if (t >= 1) {
        setReady(true);
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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
