import "./hudCorner.css";

interface HudCornerProps {
  children: React.ReactNode;
}

/* eslint-disable react/prop-types -- TS interface already covers this */

// Single translucent pill anchoring every top-right icon button (mute,
// help, ...) so they read as one HUD widget instead of separately-floating
// circles. Children should be plain `.hud-icon-button`s - this element owns
// the fixed positioning, background, and border for the whole group.
const HudCorner: React.FC<HudCornerProps> = ({ children }) => (
  <div className="hud-corner">{children}</div>
);

export default HudCorner;
