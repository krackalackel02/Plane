import { Group } from "three";
import { AxisType } from "../../../types/controlTypes";
import { print } from "../../../../utils/common";

export interface BaseMotionConfig {
  axis?: AxisType;
  positiveKey: string;
  negativeKey: string;
}

export class BaseMotion {
  protected axis: AxisType;
  protected positiveKey: string;
  protected negativeKey: string;
  protected group: Group | undefined;

  constructor({ axis, positiveKey, negativeKey }: BaseMotionConfig) {
    this.axis = axis as AxisType;
    this.positiveKey = positiveKey;
    this.negativeKey = negativeKey;
  }

  attachTo(group: Group) {
    this.group = group;
  }

  /**
   * Frame-rate-independent exponential approach of `current` toward
   * `target`: current + (current - target) * exp(-rate * delta). The pull
   * toward the target is proportional to how far off `current` is, so
   * reversing direction from full speed converges just as fast as
   * accelerating from rest - unlike constant acceleration plus passive
   * decay, where undoing a large built-up value took as long as building
   * it up. `rate` is a responsiveness constant (1/s): roughly how many
   * "e-foldings" per second toward the target, so a bigger rate means a
   * snappier response.
   */
  protected approach(
    current: number,
    target: number,
    rate: number,
    delta: number,
  ): number {
    return target + (current - target) * Math.exp(-rate * delta);
  }

  update(delta: number, activeKeys: Set<string>) {
    print("BaseMotion update", delta, activeKeys);
  }
  updateConfig(config: Partial<BaseMotionConfig>) {
    if (config.axis !== undefined) this.axis = config.axis;
    if (config.positiveKey !== undefined) this.positiveKey = config.positiveKey;
    if (config.negativeKey !== undefined) this.negativeKey = config.negativeKey;
  }
  cleanup() {
    this.group = undefined;
  }
}
