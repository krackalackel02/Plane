import { MobileView } from "react-device-detect";
import ThrottleStick from "./throttleStick";
import MovementStick from "./movementStick";
import "./mobileControls.css";

// Two floating touch sticks, laid out like a real cockpit: throttle in the
// left hand, pitch/roll stick in the right hand.
const MobileControls = () => (
  <MobileView>
    <div id="mobile-controls">
      <ThrottleStick />
      <MovementStick />
    </div>
  </MobileView>
);

export default MobileControls;
