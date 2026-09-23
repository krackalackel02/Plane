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
  progress: number; // 0-100, the real completion ratio
}

const LoadingContext = createContext<LoadingContextValue>({
  ready: false,
  progress: 0,
});

// If nothing ever starts loading (e.g. everything was already resident),
// treat it as done after this grace period rather than waiting forever.
const NOTHING_TO_LOAD_GRACE_MS = 400;

// A board's shared material textures live behind its own thumbnail texture
// in the component tree (Material is a child of Board, and a suspending
// component's render aborts before its children ever get evaluated), so
// they aren't requested until each board's own thumbnail has resolved.
// Loading here happens in waves, not one flat burst, and the manager can go
// idle between waves - so "done" requires it to STAY idle for this long with
// nothing new starting, not just look idle for one snapshot.
const SETTLE_MS = 200;

/**
 * Tracks asset loading (three's DefaultLoadingManager, via drei's
 * useProgress) and exposes a single `ready` flag once loading has settled.
 * Consumed by the loading screen (to know when to fade out) and by the
 * camera (to know when it's safe to start the intro flythrough) so both stay
 * in sync off one source of truth.
 *
 * `progress` is the manager's raw cumulative loaded/total ratio - not drei's
 * own `progress` field, which rescales its 0-100 baseline every time a new
 * wave of assets starts and visibly jumps backwards, and deliberately not
 * clamped to only increase either: waves here mean the denominator can
 * legitimately grow before the numerator catches up (more work was just
 * discovered), and hiding that behind a frozen high number would be
 * actively misleading rather than "smooth". It also doesn't try to fake a
 * smooth animated curve in JS - this app does synchronous, main-thread-
 * blocking work while loading (CSG boolean ops building the board frames,
 * GLTF parsing, image decode), during which no JS-driven per-frame update
 * can paint anyway. Instead, the loading screen renders this value with a
 * CSS `transition` on `transform`, which the browser's compositor keeps
 * animating smoothly - including through the occasional real dip - even
 * while the main thread is busy. See loadingScreen.css.
 * @returns JSX.Element
 */
export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { active, loaded, total } = useProgress();
  const [ready, setReady] = useState(false);
  const startedRef = useRef(false);

  const progress = total > 0 ? (loaded / total) * 100 : 0;

  useEffect(() => {
    if (active) startedRef.current = true;
  }, [active]);

  // Assets are actually done once the manager has both started and settled -
  // i.e. gone idle and STAYED idle for SETTLE_MS. If a new wave starts
  // before the timer fires, this effect reruns with active=true, and
  // React's effect-cleanup ordering cancels the pending timer automatically
  // before that happens.
  useEffect(() => {
    if (!active && startedRef.current && total > 0 && loaded >= total) {
      const timer = setTimeout(() => setReady(true), SETTLE_MS);
      return () => clearTimeout(timer);
    }
  }, [active, loaded, total]);

  // Nothing ever started loading - there's no real progress to wait on.
  useEffect(() => {
    if (startedRef.current) return;
    const grace = setTimeout(() => {
      if (!startedRef.current) setReady(true);
    }, NOTHING_TO_LOAD_GRACE_MS);
    return () => clearTimeout(grace);
  }, []);

  // Safety net: never let the splash block the app forever if loading stalls.
  useEffect(() => {
    const hardStop = setTimeout(() => setReady(true), 15000);
    return () => clearTimeout(hardStop);
  }, []);

  return (
    <LoadingContext.Provider
      value={{ ready, progress: ready ? 100 : progress }}
    >
      {children}
    </LoadingContext.Provider>
  );
};

/**
 * Reads the current asset-loading state from LoadingContext
 * @returns LoadingContextValue
 */
export const useLoading = () => useContext(LoadingContext);
