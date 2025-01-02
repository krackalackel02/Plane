import { Group } from "three";
import { Spring } from "wobble";
import { BaseMotion, BaseMotionConfig } from "../baseMotion";

export interface HarmonicMotionConfig extends BaseMotionConfig {
  stiffness: number;
  damping: number;
  maxAngle: number;
}

export class HarmonicMotion extends BaseMotion {
  private spring: Spring;
  private maxAngle: number;

  constructor({
    axis,
    stiffness,
    damping,
    maxAngle,
    positiveKey,
    negativeKey,
  }: HarmonicMotionConfig) {
    super({ axis, positiveKey, negativeKey });
    this.maxAngle = maxAngle;

    this.spring = new Spring({
      fromValue: 0,
      toValue: 0,
      stiffness,
      damping,
    });
  }

  attachTo(group: Group) {
    this.spring.onUpdate((state) => {
      group.rotation[this.axis] = state.currentValue;
    });
  }

  update(_delta: number, activeKeys: Set<string>) {
    if (activeKeys.has(this.positiveKey)) {
      this.spring.updateConfig({ toValue: this.maxAngle });
      this.spring.start();
    } else if (activeKeys.has(this.negativeKey)) {
      this.spring.updateConfig({ toValue: -this.maxAngle });
      this.spring.start();
    } else {
      this.spring.updateConfig({ toValue: 0 });
      this.spring.start();
    }
  }

  cleanup() {
    this.spring.removeAllListeners();
  }
}
