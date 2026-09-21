import { useAutopilot } from "../../context/autopilotContext";
import "./autopilotBanner.css";

// Bright, flashing sci-fi HUD text shown for the duration of an autopilot
// flight. Plain HTML (not inside the Canvas) - same pattern as Overlay.
const AutopilotBanner = () => {
  const { isFlying } = useAutopilot();

  if (!isFlying) return null;

  return <div id="autopilot-banner">Autopilot Engaged</div>;
};

export default AutopilotBanner;
