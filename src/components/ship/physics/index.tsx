import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, Group, Quaternion } from "three";

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
import keys from "../../../utils/keys.json";
import { HarmonicMotion } from "./motions/harmonic/harmonic";
import { PlanetMotion } from "./motions/planet/planet";
import { AutopilotMotion } from "./motions/autopilot/autopilot";
import { TrickMotion } from "./motions/trick/trick";
import { hasAnyRealControlKey, isBoostEngaged } from "../../../utils/boost";
import { useProjects } from "../../../context/projectContext";
import { spawnTransform } from "../../timeline/calculatedBoardPositionsAndRotations";

/**
 * Default motion parameters for ship physics
 * Used as fallback and for initializing controls
 * - roll: Roll motion parameters (cosmetic tilt)
 * - pitch: Pitch motion parameters (cosmetic tilt)
 * - yaw: Turning around the ship's own local up
 * - throttle: Moving along the ship's own local forward, over the planet's surface
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
    // Tuned so a full loop of the planet's equator (~267 units) at max
    // speed takes about 15s, not the multi-minute crawl the old flat-world
    // numbers (maxSpeed 2) would give on a world this size.
    acceleration: 6,
    maxSpeed: 18,
    decayFactor: 0.85,
  },
  autopilot: {
    speed: 20,
  },
};

// How much faster throttle accelerates and how much higher its top speed
// goes while the boost key is held.
const BOOST_MULTIPLIER = 1.6;

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
  const { items, activeProjectId } = useProjects();

  const [params, setParams] = useState(initialParams);

  // Roll and pitch are purely cosmetic banking, layered on top of the
  // ship's actual surface heading (see PlanetMotion) rather than driving it
  // - they're sprung onto lightweight dummy targets, not the real ship
  // group, so Physics can compose (heading * tilt) itself each frame
  // instead of the tilt silently becoming part of "current heading".
  const rollTarget = useRef(new Group());
  const pitchTarget = useRef(new Group());
  const motions = useRef({
    [Motion.ROLL]: createMotion(Motion.ROLL),
    [Motion.PITCH]: createMotion(Motion.PITCH),
  });

  const planetMotion = useRef(
    new PlanetMotion(
      { yaw: initialParams.yaw, throttle: initialParams.throttle },
      keys.yaw,
      keys.throttle,
    ),
  );

  const activeKeys = useKeyContext();
  const { target, cancelAutopilot, setIsFlying } = useAutopilot();
  const autopilotMotion = useRef(new AutopilotMotion());
  // Tracks which request object is currently being flown to (not just a
  // flying/not-flying boolean), so a new requestAutopilot() call mid-flight
  // - a different target reference - is detected and restarts the path
  // from the ship's current position, rather than silently continuing
  // toward the stale destination.
  const activeTargetRef = useRef<AutopilotTarget | null>(null);

  const { trickRequest, clearTrickRequest, setActiveTrickDirection } =
    useTrick();
  const trickMotion = useRef(new TrickMotion());
  // Tracks which trickRequest id is currently playing, mirroring
  // activeTargetRef's pattern, so a fresh request (a new tap) is told apart
  // from the one already animating.
  const activeTrickRef = useRef<number | null>(null);

  // Spawn the ship on the planet's shell and attach motions on mount.
  useEffect(() => {
    if (!groupRef.current) return;

    const { position, orientation } = spawnTransform(items);
    groupRef.current.position.copy(position);
    groupRef.current.quaternion.copy(orientation);

    motions.current[Motion.ROLL].attachTo(rollTarget.current);
    motions.current[Motion.PITCH].attachTo(pitchTarget.current);
    planetMotion.current.attachTo(groupRef.current);
    trickMotion.current.attachTo(rollTarget.current);

    return () => {
      Object.values(motions.current).forEach((motion) => motion.cleanup());
      planetMotion.current.cleanup();
      autopilotMotion.current.cleanup();
      trickMotion.current.cleanup();
    };
  }, [groupRef]);

  // Update motions each frame
  useFrame((_, delta) => {
    const ship = groupRef.current;
    if (!ship) return;

    const isBoosting = isBoostEngaged(activeKeys);

    if (target) {
      if (activeTargetRef.current !== target) {
        // First engagement, or requestAutopilot() was called again with a
        // new destination mid-flight - (re)plan from wherever the ship
        // actually is right now, not its original starting point.
        autopilotMotion.current.start(
          ship.position.clone(),
          target.position,
          params.autopilot.speed,
        );
        activeTargetRef.current = target;
        setIsFlying(true);
      }

      const result = autopilotMotion.current.update(
        delta,
        hasAnyRealControlKey(activeKeys),
      );
      // The project popup (Highlight) opens the instant the ship enters a
      // board's activation zone - a separate, proximity-based check from
      // this arc's own progress - so it can appear before progress
      // reaches 1. Treat a popup opening mid-flight as arrival: otherwise
      // the arc keeps "flying" underneath the popup (isFlying stays
      // true), leaving the exhaust lit and autopilot nominally still
      // engaged for however long the popup stays open.
      const flightEnded = result.status !== "flying" || activeProjectId;
      if (flightEnded) {
        cancelAutopilot();
        activeTargetRef.current = null;
        setIsFlying(false);
      }

      // Let roll/pitch decay smoothly back to level while under autopilot,
      // rather than freezing wherever they were the instant it engaged.
      motions.current[Motion.ROLL].update(delta, new Set());
      motions.current[Motion.PITCH].update(delta, new Set());

      const tilt = new Quaternion().setFromEuler(
        new Euler(
          pitchTarget.current.rotation.x,
          0,
          rollTarget.current.rotation.z,
        ),
      );
      ship.position.copy(result.position);
      ship.quaternion.copy(result.orientation);
      if (flightEnded) {
        // Hand the heading back. PlanetMotion keeps orientation as internal
        // state and only re-syncs position from the caller each frame, so
        // without this it resumes manual flight on whatever heading it held
        // when autopilot engaged - snapping the ship away from the board it
        // just arrived facing. Seeded before the cosmetic tilt is applied, so
        // it adopts the true surface heading rather than the roll/pitch lean.
        planetMotion.current.attachTo(ship);
      }
      ship.quaternion.multiply(tilt);
      return; // skip manual motions entirely this frame
    }

    if (trickRequest !== null && activeTrickRef.current !== trickRequest.id) {
      // New tap on the ship - hand the roll axis to the trick animation so
      // it can't fight a held roll key while it plays.
      (motions.current[Motion.ROLL] as HarmonicMotion).pause();
      trickMotion.current.start(trickRequest.direction);
      activeTrickRef.current = trickRequest.id;
      setActiveTrickDirection(trickRequest.direction);
    }

    if (activeTrickRef.current !== null) {
      const status = trickMotion.current.update(delta);
      if (status === "done") {
        activeTrickRef.current = null;
        clearTrickRequest();
        setActiveTrickDirection(null);
      }
    }

    if (activeTrickRef.current === null) {
      motions.current[Motion.ROLL].updateConfig(params.roll);
      motions.current[Motion.ROLL].update(delta, activeKeys);
    }
    motions.current[Motion.PITCH].updateConfig(params.pitch);
    motions.current[Motion.PITCH].update(delta, activeKeys);

    const throttleConfig = isBoosting
      ? {
          ...params.throttle,
          acceleration: params.throttle.acceleration * BOOST_MULTIPLIER,
          maxSpeed: params.throttle.maxSpeed * BOOST_MULTIPLIER,
        }
      : params.throttle;
    planetMotion.current.updateConfig({
      yaw: params.yaw,
      throttle: throttleConfig,
    });
    const base = planetMotion.current.update(delta, activeKeys, ship.position);

    const tilt = new Quaternion().setFromEuler(
      new Euler(
        pitchTarget.current.rotation.x,
        0,
        rollTarget.current.rotation.z,
      ),
    );
    ship.position.copy(base.position);
    ship.quaternion.copy(base.orientation).multiply(tilt);
  });

  return helper ? (
    <Suspense fallback={null}>
      <PhysicsDebugControls params={params} setParams={setParams} />
    </Suspense>
  ) : null;
};

export default Physics;
