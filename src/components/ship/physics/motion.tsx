import { Group } from "three";
import { AxisType } from "../../types/types";
import { print } from "../../../utils/common";

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

  update(delta: number, activeKeys: Set<string>) {
    print("BaseMotion update", delta, activeKeys);
  }

  cleanup() {
    this.group = undefined;
  }
}
