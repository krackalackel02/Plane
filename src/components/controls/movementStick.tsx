import { useCallback, useRef } from "react";
import { Joystick } from "react-joystick-component";
import { useKeyControls } from "../../context/keyContext";
import keys from "../../utils/keys.json";

// Fraction of the stick's max travel that must be crossed before a
// direction engages. Below this radius the stick is considered
// "centered" so a stray tap can't be read as an intended move.
const DEADZONE = 0.35;

interface StickAxes {
  pitchPositive: boolean;
  pitchNegative: boolean;
  rollPositive: boolean;
  rollNegative: boolean;
}

const neutralAxes: StickAxes = {
  pitchPositive: false,
  pitchNegative: false,
  rollPositive: false,
  rollNegative: false,
};

const MovementStick = () => {
  const { pressKey, releaseKey } = useKeyControls();
  const activeAxes = useRef<StickAxes>({ ...neutralAxes });

  const applyAxes = useCallback(
    (next: StickAxes) => {
      const prev = activeAxes.current;

      if (next.pitchPositive !== prev.pitchPositive) {
        (next.pitchPositive ? pressKey : releaseKey)(keys.pitch.positive);
      }
      if (next.pitchNegative !== prev.pitchNegative) {
        (next.pitchNegative ? pressKey : releaseKey)(keys.pitch.negative);
      }
      if (next.rollPositive !== prev.rollPositive) {
        (next.rollPositive ? pressKey : releaseKey)(keys.roll.positive);
      }
      if (next.rollNegative !== prev.rollNegative) {
        (next.rollNegative ? pressKey : releaseKey)(keys.roll.negative);
      }

      activeAxes.current = next;
    },
    [pressKey, releaseKey],
  );

  const handleMove = useCallback(
    (event: { x: number | null; y: number | null }) => {
      const x = event.x ?? 0;
      const y = event.y ?? 0;

      // Below the deadzone radius, treat the stick as centered on both
      // axes at once rather than letting a lingering axis stay engaged.
      if (Math.hypot(x, y) < DEADZONE) {
        applyAxes({ ...neutralAxes });
        return;
      }

      applyAxes({
        pitchPositive: y > DEADZONE,
        pitchNegative: y < -DEADZONE,
        rollPositive: x > DEADZONE,
        rollNegative: x < -DEADZONE,
      });
    },
    [applyAxes],
  );

  const handleStop = useCallback(() => {
    applyAxes({ ...neutralAxes });
  }, [applyAxes]);

  return (
    <div className="mobile-stick mobile-stick--movement">
      <Joystick
        size={100}
        baseColor="rgba(255, 255, 255, 0.15)"
        stickColor="rgba(255, 255, 255, 0.55)"
        move={handleMove}
        stop={handleStop}
      />
    </div>
  );
};

export default MovementStick;
