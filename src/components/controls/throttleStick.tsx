import LinearStick from "./linearStick";
import keys from "../../utils/keys.json";

const ThrottleStick = () => (
  <LinearStick
    orientation="vertical"
    positiveKey={keys.throttle.positive}
    negativeKey={keys.throttle.negative}
    positiveLabel="▲"
    negativeLabel="▼"
  />
);

export default ThrottleStick;
