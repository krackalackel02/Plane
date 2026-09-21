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
      const scale = distance > travel ? travel / distance : 1;
      const clampedDx = rawDx * scale;
      const clampedDy = rawDy * scale;

      const normalizedX = clampedDx / travel;
      const normalizedY = -clampedDy / travel; // up (smaller clientY) is positive

      setKnobOffset({ x: clampedDx, y: clampedDy });

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
    [applyAxes],
  );

  const reset = useCallback(() => {
    setKnobOffset({ x: 0, y: 0 });
    applyAxes({ ...neutralAxes });
  }, [applyAxes]);

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
  useEffect(() => () => applyAxes({ ...neutralAxes }), [applyAxes]);

  return (
    <div className="mobile-stick circular-stick">
      <div
        ref={trackRef}
        className="circular-stick-track"
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
          className="circular-stick-knob"
          style={{
            transform: `translate(-50%, -50%) translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>
    </div>
  );
};

export default MovementStick;
