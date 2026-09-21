import { MobileView } from "react-device-detect";
import ThrottleStick from "./throttleStick";
import YawStick from "./yawStick";
import "./mobileControls.css";

// Two floating touch bars, laid out like a real cockpit: throttle in the
// left hand, yaw in the right hand. Pitch/roll are handled separately by
// swiping directly on the ship model.
const MobileControls = () => (
  <MobileView>
    <div id="mobile-controls">
      <ThrottleStick />
      <YawStick />
    </div>
  </MobileView>
);

export default MobileControls;
