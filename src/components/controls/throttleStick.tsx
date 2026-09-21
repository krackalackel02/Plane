import { useCallback, useEffect, useRef, useState } from "react";
import { useKeyControls } from "../../context/keyContext";
import keys from "../../utils/keys.json";

// Fraction of the track's half-height that must be crossed before the
// throttle actually engages, so resting a thumb near the center doesn't
// register as forward/backward input.
const DEADZONE = 0.35;
// Must match the knob's diameter in throttleStick.css, so it can't be
// dragged past the ends of the track.
const KNOB_RADIUS = 25;

type ThrottleAxis = "positive" | "negative" | null;

const ThrottleStick = () => {
  const { pressKey, releaseKey } = useKeyControls();
  const trackRef = useRef<HTMLDivElement>(null);
  const activeAxis = useRef<ThrottleAxis>(null);
  const pointerId = useRef<number | null>(null);
  // Knob's visual offset from center, in pixels (negative = up/forward).
  const [knobOffsetPx, setKnobOffsetPx] = useState(0);

  const setAxis = useCallback(
    (next: ThrottleAxis) => {
      if (next === activeAxis.current) return;

      if (activeAxis.current === "positive") releaseKey(keys.throttle.positive);
      if (activeAxis.current === "negative") releaseKey(keys.throttle.negative);
      if (next === "positive") pressKey(keys.throttle.positive);
      if (next === "negative") pressKey(keys.throttle.negative);

      activeAxis.current = next;
    },
    [pressKey, releaseKey],
  );

  const updateFromClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const halfHeight = rect.height / 2;
      const travel = Math.max(halfHeight - KNOB_RADIUS, 1);

      // Up is positive (forward), matching the pitch stick's convention.
      const rawOffset = centerY - clientY;
      const clampedOffset = Math.max(-travel, Math.min(travel, rawOffset));
      const normalized = clampedOffset / travel;

      setKnobOffsetPx(-clampedOffset);

      if (Math.abs(normalized) < DEADZONE) {
        setAxis(null);
      } else {
        setAxis(normalized > 0 ? "positive" : "negative");
      }
    },
    [setAxis],
  );

  const reset = useCallback(() => {
    setKnobOffsetPx(0);
    setAxis(null);
  }, [setAxis]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      pointerId.current = event.pointerId;
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      updateFromClientY(event.clientY);
    },
    [updateFromClientY],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerId !== pointerId.current) return;
      event.preventDefault();
      updateFromClientY(event.clientY);
    },
    [updateFromClientY],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerId !== pointerId.current) return;
      pointerId.current = null;
      reset();
    },
    [reset],
  );

  // If the component unmounts mid-drag, release whatever key is held.
  useEffect(() => () => setAxis(null), [setAxis]);

  return (
    <div className="mobile-stick mobile-stick--throttle">
      <div
        ref={trackRef}
        className="throttle-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="throttle-knob"
          style={{
            transform: `translate(-50%, -50%) translateY(${knobOffsetPx}px)`,
          }}
        />
      </div>
    </div>
  );
};

export default ThrottleStick;
