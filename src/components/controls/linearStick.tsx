import { useCallback, useEffect, useRef, useState } from "react";
import { useKeyControls } from "../../context/keyContext";

/* eslint-disable react/prop-types */

// Fraction of the track's half-length that must be crossed before the
// stick actually engages, so resting a thumb near the center doesn't
// register as input.
const DEADZONE = 0.35;
// Must match the knob's diameter in mobileControls.css, so it can't be
// dragged past the ends of the track.
const KNOB_RADIUS = 25;

type StickAxis = "positive" | "negative" | null;

interface LinearStickProps {
  // "vertical": up is positive. "horizontal": right is positive.
  orientation: "horizontal" | "vertical";
  positiveKey: string;
  negativeKey: string;
  positiveLabel: string;
  negativeLabel: string;
}

// A single-axis touch stick that snaps back to center on release — used
// for both the throttle (vertical) and yaw (horizontal) controls, since
// both are "drag past a deadzone to hold a direction" with no other
// difference than which screen axis and which pair of keys they drive.
const LinearStick: React.FC<LinearStickProps> = ({
  orientation,
  positiveKey,
  negativeKey,
  positiveLabel,
  negativeLabel,
}) => {
  const { pressKey, releaseKey } = useKeyControls();
  const trackRef = useRef<HTMLDivElement>(null);
  const activeAxis = useRef<StickAxis>(null);
  const pointerId = useRef<number | null>(null);
  // Knob's visual offset from center, in pixels.
  const [knobOffsetPx, setKnobOffsetPx] = useState(0);

  const isVertical = orientation === "vertical";

  const setAxis = useCallback(
    (next: StickAxis) => {
      if (next === activeAxis.current) return;

      if (activeAxis.current === "positive") releaseKey(positiveKey);
      if (activeAxis.current === "negative") releaseKey(negativeKey);
      if (next === "positive") pressKey(positiveKey);
      if (next === "negative") pressKey(negativeKey);

      activeAxis.current = next;
    },
    [pressKey, releaseKey, positiveKey, negativeKey],
  );

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const track = trackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const length = isVertical ? rect.height : rect.width;
      const half = length / 2;
      const travel = Math.max(half - KNOB_RADIUS, 1);

      // Vertical: up (smaller clientY) is positive.
      // Horizontal: right (larger clientX) is positive.
      const rawOffset = isVertical
        ? rect.top + half - clientY
        : clientX - (rect.left + half);
      const clampedOffset = Math.max(-travel, Math.min(travel, rawOffset));
      const normalized = clampedOffset / travel;

      setKnobOffsetPx(isVertical ? -clampedOffset : clampedOffset);

      if (Math.abs(normalized) < DEADZONE) {
        setAxis(null);
      } else {
        setAxis(normalized > 0 ? "positive" : "negative");
      }
    },
    [isVertical, setAxis],
  );

  const reset = useCallback(() => {
    setKnobOffsetPx(0);
    setAxis(null);
  }, [setAxis]);

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

  // If the component unmounts mid-drag, release whatever key is held.
  useEffect(() => () => setAxis(null), [setAxis]);

  const knobTransform = isVertical
    ? `translate(-50%, -50%) translateY(${knobOffsetPx}px)`
    : `translate(-50%, -50%) translateX(${knobOffsetPx}px)`;

  return (
    <div className={`mobile-stick linear-stick linear-stick--${orientation}`}>
      <div
        ref={trackRef}
        className="linear-stick-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span
          className={`stick-label stick-label--${isVertical ? "top" : "right"}`}
        >
          {positiveLabel}
        </span>
        <span
          className={`stick-label stick-label--${isVertical ? "bottom" : "left"}`}
        >
          {negativeLabel}
        </span>
        <div
          className="linear-stick-knob"
          style={{ transform: knobTransform }}
        />
      </div>
    </div>
  );
};

export default LinearStick;
