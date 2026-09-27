import { useKeyContext } from "../../context/keyContext";
import keys from "../../utils/keys.json";
import "./boostBanner.css";

// Bright, flashing green HUD text shown while boost is engaged - either the
// Shift key on desktop or the mobile joystick snapped into its boost ring.
// Plain HTML (not inside the Canvas) - same pattern as AutopilotBanner.
const BoostBanner = () => {
  const activeKeys = useKeyContext();
  const isBoosting = activeKeys.has(keys.boost);

  if (!isBoosting) return null;

  return <div id="boost-banner">Boost Engaged</div>;
};

export default BoostBanner;
