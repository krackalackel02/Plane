import { useCallback, useEffect, useRef, useState } from "react";
import { useKeyControls } from "../../context/keyContext";
import keys from "../../utils/keys.json";

// Fraction of the stick's max travel that must be crossed (combined
// magnitude) before any direction engages, so resting a thumb near the
// center doesn't register as intended movement.
const DEADZONE = 0.35;
// Must match the knob's diameter in mobileControls.css, so it can't be
// dragged past the edge of the circular track.
const KNOB_RADIUS = 25;
// How far past the base radius (in px) the knob can be pulled into the
// outer "boost ring" - must match the ::after ring size in
// mobileControls.css.
const BOOST_RING_WIDTH = 24;
// Fraction of the boost ring that must be crossed before the stick snaps
// out to the boost detent and engages boost.
const BOOST_ENGAGE_FRACTION = 0.6;
// Fraction of the boost ring the pull must fall back under to disengage -
// lower than the engage fraction so hovering near the boundary doesn't
// rapidly flicker boost on/off.
const BOOST_DISENGAGE_FRACTION = 0.3;

interface StickAxes {
  throttleUp: boolean;
  throttleDown: boolean;
  yawRight: boolean;
  yawLeft: boolean;
}

const neutralAxes: StickAxes = {
  throttleUp: false,
  throttleDown: false,
  yawRight: false,
  yawLeft: false,
};

// A single circular touch stick driving two independent axes at once:
// vertical (throttle, w/s) and horizontal (yaw, a/d) — the same four
// directions the two separate linear bars drove, just read from one
// physical drag instead of two.
const MovementStick = () => {
  const { pressKey, releaseKey } = useKeyControls();
  const trackRef = useRef<HTMLDivElement>(null);
  const activeAxes = useRef<StickAxes>({ ...neutralAxes });
  const pointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const isBoosting = useRef(false);
  const [isBoostActive, setIsBoostActive] = useState(false);

  const applyAxes = useCallback(
    (next: StickAxes) => {
      const prev = activeAxes.current;

      if (next.throttleUp !== prev.throttleUp) {
        (next.throttleUp ? pressKey : releaseKey)(keys.throttle.positive);
      }
      if (next.throttleDown !== prev.throttleDown) {
        (next.throttleDown ? pressKey : releaseKey)(keys.throttle.negative);
      }
      // "Right" turn is driven by yaw.negative, not yaw.positive — see
      // keyContext's determineControlState and YawMotion's rotation math.
      if (next.yawRight !== prev.yawRight) {
        (next.yawRight ? pressKey : releaseKey)(keys.yaw.negative);
      }
      if (next.yawLeft !== prev.yawLeft) {
        (next.yawLeft ? pressKey : releaseKey)(keys.yaw.positive);
      }

      activeAxes.current = next;
    },
    [pressKey, releaseKey],
  );

  const applyBoost = useCallback(
    (next: boolean) => {
      if (next === isBoosting.current) return;
      (next ? pressKey : releaseKey)(keys.boost);
      isBoosting.current = next;
      setIsBoostActive(next);
    },
    [pressKey, releaseKey],
  );

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const track = trackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const travel = Math.max(rect.width / 2 - KNOB_RADIUS, 1);

      const rawDx = clientX - centerX;
      const rawDy = clientY - centerY;
      const distance = Math.hypot(rawDx, rawDy);

      // Direction (throttle/yaw) always saturates at the base radius,
      // regardless of how far into the boost ring the drag continues - so
      // pulling further only toggles boost, it doesn't also add turn or
      // throttle magnitude on top of an already-full deflection.
      const axisScale = distance > travel ? travel / distance : 1;
      const normalizedX = (rawDx * axisScale) / travel;
      const normalizedY = -(rawDy * axisScale) / travel; // up (smaller clientY) is positive

      // How far past the base radius the drag has gone, as a fraction of
      // the boost ring's width (0 at the base radius, 1 at its outer edge
      // and beyond) - snapping boost on/off off this with hysteresis so the
      // engage and disengage points aren't the same threshold.
      const boostPull = Math.min(
        Math.max((distance - travel) / BOOST_RING_WIDTH, 0),
        1,
      );
      const shouldBoost = isBoosting.current
        ? boostPull > BOOST_DISENGAGE_FRACTION
        : boostPull >= BOOST_ENGAGE_FRACTION;
      applyBoost(shouldBoost);

      // The knob itself snaps out to sit at the boost ring's outer edge
      // once boost engages (rather than continuing to track the finger
      // 1:1), giving a tactile "detent" confirming boost is on.
      const renderTravel = isBoosting.current
        ? travel + BOOST_RING_WIDTH
        : travel;
      const renderScale = distance > renderTravel ? renderTravel / distance : 1;
      setKnobOffset({ x: rawDx * renderScale, y: rawDy * renderScale });

      if (Math.hypot(normalizedX, normalizedY) < DEADZONE) {
        applyAxes({ ...neutralAxes });
        return;
      }

      applyAxes({
        throttleUp: normalizedY > DEADZONE,
        throttleDown: normalizedY < -DEADZONE,
        yawRight: normalizedX > DEADZONE,
        yawLeft: normalizedX < -DEADZONE,
      });
    },
    [applyAxes, applyBoost],
  );

  const reset = useCallback(() => {
    setKnobOffset({ x: 0, y: 0 });
    applyAxes({ ...neutralAxes });
    applyBoost(false);
  }, [applyAxes, applyBoost]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      pointerId.current = event.pointerId;
      try {
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        // Some engines reject capture for a pointerId they don't recognize
        // as an active session (seen with synthetic test events); capture
        // is a reliability nicety here, not required for the drag to work.
      }
      updateFromPointer(event.clientX, event.clientY);
    },
    [updateFromPointer],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerId !== pointerId.current) return;
      event.preventDefault();
      updateFromPointer(event.clientX, event.clientY);
    },
    [updateFromPointer],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerId !== pointerId.current) return;
      pointerId.current = null;
      reset();
    },
    [reset],
  );

  // If the component unmounts mid-drag, release whatever keys are held.
  useEffect(
    () => () => {
      applyAxes({ ...neutralAxes });
      applyBoost(false);
    },
    [applyAxes, applyBoost],
  );

  return (
    <div className="mobile-stick circular-stick">
      <div
        ref={trackRef}
        className={`circular-stick-track${isBoostActive ? " is-boosting" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="stick-label stick-label--top">▲</span>
        <span className="stick-label stick-label--bottom">▼</span>
        <span className="stick-label stick-label--left">↺</span>
        <span className="stick-label stick-label--right">↻</span>
        <div
          className={`circular-stick-knob${isBoostActive ? " is-boosting" : ""}`}
          style={{
            transform: `translate(-50%, -50%) translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>
    </div>
  );
};

export default MovementStick;
