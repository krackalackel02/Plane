import { Group } from "three";
import { AxisType } from "../../../types/controlTypes";
import { print } from "../../../../utils/common";

export interface BaseMotionConfig {
  axis?: AxisType;
  positiveKey: string;
  negativeKey: string;
  decayFactor?: number;
}

export class BaseMotion {
  protected axis: AxisType;
  protected positiveKey: string;
  protected negativeKey: string;
  protected decayFactor: number;
  protected group: Group | undefined;

  constructor({
    axis,
    positiveKey,
    negativeKey,
    decayFactor = 0.95,
  }: BaseMotionConfig) {
    this.axis = axis as AxisType;
    this.positiveKey = positiveKey;
    this.negativeKey = negativeKey;
    this.decayFactor = decayFactor;
  }

  attachTo(group: Group) {
    this.group = group;
  }

  // decayFactor is tuned as the per-frame multiplier at this reference
  // rate. Raising it to (delta * DECAY_REFERENCE_FPS) reproduces that same
  // tuned coast-down feel at any frame rate, instead of the old
  // `value *= decayFactor` which drained velocity once per *rendered
  // frame* - roughly 2.4x faster per second on a 144Hz display than on 60Hz.
  private static readonly DECAY_REFERENCE_FPS = 60;

  protected decay(value: number, delta: number): number {
    return (
      value * Math.pow(this.decayFactor, delta * BaseMotion.DECAY_REFERENCE_FPS)
    );
  }

  update(delta: number, activeKeys: Set<string>) {
    print("BaseMotion update", delta, activeKeys);
  }
  updateConfig(config: Partial<BaseMotionConfig>) {
    if (config.axis !== undefined) this.axis = config.axis;
    if (config.positiveKey !== undefined) this.positiveKey = config.positiveKey;
    if (config.negativeKey !== undefined) this.negativeKey = config.negativeKey;
    if (config.decayFactor !== undefined) this.decayFactor = config.decayFactor;
  }
  cleanup() {
    this.group = undefined;
  }
}
