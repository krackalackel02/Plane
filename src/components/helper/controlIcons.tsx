import "./controlIcons.css";

/* eslint-disable react/prop-types -- TS interfaces already cover this */

interface KeycapProps {
  label: string;
  wide?: boolean;
  // Smaller variant used inline in the welcome popup, next to prose.
  compact?: boolean;
}

// A single cartoony beveled keyboard key. Shared by the welcome popup and
// the full controls modal so both draw keys identically.
export const Keycap: React.FC<KeycapProps> = ({
  label,
  wide = false,
  compact = false,
}) => (
  <span
    className={`keycap${wide ? " keycap--wide" : ""}${compact ? " keycap--compact" : ""}`}
  >
    {label}
  </span>
);

interface JoystickIconProps {
  compact?: boolean;
}

// Mirrors the on-screen mobile joystick's own direction glyphs
// (movementStick.tsx) so the icon matches what players actually see.
export const JoystickIcon: React.FC<JoystickIconProps> = ({
  compact = false,
}) => (
  <div
    className={`help-joystick${compact ? " help-joystick--compact" : ""}`}
    aria-hidden="true"
  >
    <span className="help-joystick-hint help-joystick-hint--top">▲</span>
    <span className="help-joystick-hint help-joystick-hint--bottom">▼</span>
    <span className="help-joystick-hint help-joystick-hint--left">↺</span>
    <span className="help-joystick-hint help-joystick-hint--right">↻</span>
    <span className="help-joystick-knob" />
  </div>
);
