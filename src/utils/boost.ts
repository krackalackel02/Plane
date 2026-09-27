import keys from "./keys.json";
import { ControlKeys } from "../components/types/controlTypes";

const controlKeys = keys as ControlKeys;

/**
 * True if any real movement key (roll/pitch/yaw/throttle) is held - excludes
 * the exhaust key, which is cosmetic-adjacent rather than a real motion
 * input.
 */
export const hasAnyRealControlKey = (activeKeys: Set<string>) =>
  [
    controlKeys.roll,
    controlKeys.pitch,
    controlKeys.yaw,
    controlKeys.throttle,
  ].some(
    ({ positive, negative }) =>
      activeKeys.has(positive) || activeKeys.has(negative),
  );

/**
 * Boost only actually engages while the boost key is held together with
 * some real steering/throttle input - holding it on its own (idle, no
 * direction) shouldn't count as boosting. Shared by Physics, Exhaust, and
 * BoostBanner so they can't drift out of sync on what "boosting" means.
 */
export const isBoostEngaged = (activeKeys: Set<string>) =>
  activeKeys.has(controlKeys.boost) && hasAnyRealControlKey(activeKeys);
