import { MobileView } from "react-device-detect";
import MovementStick from "./movementStick";
import "./mobileControls.css";

// One floating circular joystick driving throttle (up/down) and yaw
// (left/right) together. Pitch/roll are handled separately by swiping
// directly on the ship model.
const MobileControls = () => (
  <MobileView>
    <div id="mobile-controls">
      <MovementStick />
    </div>
  </MobileView>
);

export default MobileControls;
