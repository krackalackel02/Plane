import { useBoundary } from "../../context/boundaryContext";
import "./outOfZoneBanner.css";

// Bright red, flashing sci-fi HUD warning shown while the ship is
// thrusting against the world boundary (see ship/physics/collision) -
// same pattern as AutopilotBanner, just for the opposite situation:
// pushing to leave the zone instead of flying somewhere inside it.
const OutOfZoneBanner = () => {
  const { isOutOfZone } = useBoundary();

  if (!isOutOfZone) return null;

  return <div id="out-of-zone-banner">Out Of Zone</div>;
};

export default OutOfZoneBanner;
