import LinearStick from "./linearStick";
import keys from "../../utils/keys.json";

// Right (the stick's "positive" direction) reads as isRight in
// keyContext's determineControlState, which is driven by yaw.negative —
// not yaw.positive. Confirmed against YawMotion's rotation math too:
// yaw.negative ("d") turns the nose right, yaw.positive ("a") turns left.
const YawStick = () => (
  <LinearStick
    orientation="horizontal"
    positiveKey={keys.yaw.negative}
    negativeKey={keys.yaw.positive}
    positiveLabel="↻"
    negativeLabel="↺"
  />
);

export default YawStick;
