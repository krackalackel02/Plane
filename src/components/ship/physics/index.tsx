import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

// Leva's debug panel is only used when helper=true (never in production
// usage). Lazy-load it so leva and its deps don't bloat the main bundle.
const PhysicsDebugControls = lazy(() => import("./physicsDebugControls"));

// Motion helper utilities
import { Motion, createMotion } from "./helper/motion";
import { useKeyContext } from "../../../context/keyContext";
import { useScene } from "../../../context/sceneContext";
import {
  useAutopilot,
  AutopilotTarget,
} from "../../../context/autopilotContext";
import { useTrick } from "../../../context/trickContext";
import motionConstants from "../../../utils/motionConstants.json";
import { HarmonicMotion } from "./motions/harmonic/harmonic";
import { AutopilotMotion } from "./motions/autopilot/autopilot";
import { TrickMotion } from "./motions/trick/trick";
import keys from "../../../utils/keys.json";

/**
 * Default motion parameters for ship physics
 * Used as fallback and for initializing controls
 * - roll: Roll motion parameters
 * - pitch: Pitch motion parameters
 * - yaw: Yaw motion parameters
 * - throttle: Throttle motion parameters
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/prop-types */
const defaultMotionParams = {
  roll: {
    stiffness: 50,
    damping: 4,
    maxAngle: 30,
    axis: "z",
  },
  pitch: {
    stiffness: 50,
    damping: 4,
    maxAngle: 15,
    axis: "x",
  },
  yaw: {
    decayFactor: 0.9,
    axis: "y",
    acceleration: 0.5,
    maxSpeed: 5,
  },
  throttle: {
    acceleration: 0.5,
    maxSpeed: 2,
    decayFactor: 0.85,
  },
  autopilot: {
    speed: 12,
  },
};

/**
 * True if any real movement key (roll/pitch/yaw/throttle) is held -
 * excludes the exhaust key, which is cosmetic-adjacent rather than a real
 * motion input. Manual input like this always takes over from autopilot.
 */
const hasAnyRealControlKey = (activeKeys: Set<string>) =>
  [keys.roll, keys.pitch, keys.yaw, keys.throttle].some(
    ({ positive, negative }) =>
      activeKeys.has(positive) || activeKeys.has(negative),
  );

/**
 * Props for Physics component
 * - groupRef: Reference to the ship's group object
 * - helper: Optional boolean to enable motion parameter controls
 */
interface PhysicsProps {
  helper?: boolean; // Optional prop
}

const Physics: React.FC<PhysicsProps> = ({ helper = false }) => {
  // Initialize motion parameters state
  const initialParams: Record<keyof typeof defaultMotionParams, any> = {
    roll: { ...defaultMotionParams.roll, ...motionConstants.roll },
    pitch: { ...defaultMotionParams.pitch, ...motionConstants.pitch },
    yaw: { ...defaultMotionParams.yaw, ...motionConstants.yaw },
    throttle: { ...defaultMotionParams.throttle, ...motionConstants.throttle },
    autopilot: {
      ...defaultMotionParams.autopilot,
      ...motionConstants.autopilot,
    },
  };

  const { shipRef: groupRef } = useScene();

  const [params, setParams] = useState(initialParams);

  // Refs to motion instances
  const motions = useRef({
    [Motion.ROLL]: createMotion(Motion.ROLL),
    [Motion.PITCH]: createMotion(Motion.PITCH),
    [Motion.YAW]: createMotion(Motion.YAW),
    [Motion.THROTTLE]: createMotion(Motion.THROTTLE),
  });

  const activeKeys = useKeyContext();
  const { target, cancelAutopilot, setIsFlying } = useAutopilot();
  const autopilotMotion = useRef(new AutopilotMotion());
  // Tracks which request object is currently being flown to (not just a
  // flying/not-flying boolean), so a new requestAutopilot() call mid-flight
  // - a different target reference - is detected and restarts the path
  // from the ship's current position, rather than silently continuing
  // toward the stale destination.
  const activeTargetRef = useRef<AutopilotTarget | null>(null);

  const { trickToken, clearTrick } = useTrick();
  const trickMotion = useRef(new TrickMotion());
  // Tracks which trickToken is currently playing, mirroring
  // activeTargetRef's pattern, so a fresh token (a new tap) is told apart
  // from the one already animating.
  const activeTrickRef = useRef<number | null>(null);

  // Attach motions to the group on mount
  useEffect(() => {
    if (!groupRef.current) return;

    Object.values(motions.current).forEach((motion) => {
      if (groupRef.current) motion.attachTo(groupRef.current);
    });
    autopilotMotion.current.attachTo(groupRef.current);
    trickMotion.current.attachTo(groupRef.current);

    return () => {
      Object.values(motions.current).forEach((motion) => motion.cleanup());
      autopilotMotion.current.cleanup();
      trickMotion.current.cleanup();
    };
  }, [groupRef]);

  // Update motions each frame
  useFrame((_, delta) => {
    if (target) {
      if (activeTargetRef.current !== target) {
        // First engagement, or requestAutopilot() was called again with a
        // new destination mid-flight - (re)plan from wherever the ship
        // actually is right now, not its original starting point.
        // Roll/pitch springs run their own independent RAF loop - if the
        // ship was mid-roll/pitch the instant autopilot engaged, a plain
        // "stop calling update()" wouldn't stop that stale spring from
        // still overwriting rotation underneath the flight path.
        (motions.current[Motion.ROLL] as HarmonicMotion).pause();
        (motions.current[Motion.PITCH] as HarmonicMotion).pause();
        autopilotMotion.current.start(
          groupRef.current!.position.clone(),
          target.position,
          target.arcRadius,
          params.autopilot.speed,
        );
        activeTargetRef.current = target;
        setIsFlying(true);
      }

      const status = autopilotMotion.current.update(
        delta,
        hasAnyRealControlKey(activeKeys),
      );
      if (status !== "flying") {
        cancelAutopilot();
        activeTargetRef.current = null;
        setIsFlying(false);
      }
      return; // skip the four normal motions entirely this frame
    }

    if (trickToken !== null && activeTrickRef.current !== trickToken) {
      // New tap on the ship - hand the roll axis to the trick animation so
      // it can't fight a held roll key while it plays.
      (motions.current[Motion.ROLL] as HarmonicMotion).pause();
      trickMotion.current.start();
      activeTrickRef.current = trickToken;
    }

    if (activeTrickRef.current !== null) {
      const status = trickMotion.current.update(delta);
      if (status === "done") {
        activeTrickRef.current = null;
        clearTrick();
      }
    }

    Object.entries(motions.current).forEach(([type, motion]) => {
      if (type === Motion.ROLL && activeTrickRef.current !== null) return;
      const config = params[type as keyof typeof params];
      motion.updateConfig(config);
      motion.update(delta, activeKeys);
    });
  });

  return helper ? (
    <Suspense fallback={null}>
      <PhysicsDebugControls params={params} setParams={setParams} />
    </Suspense>
  ) : null;
};

export default Physics;
