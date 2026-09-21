import { Group } from "three";
import { Spring } from "wobble";
import { BaseMotion, BaseMotionConfig } from "../baseMotion";
import { deg2rad } from "../../../../../utils/3d";

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
    this.maxAngle = deg2rad(maxAngle);

    this.spring = new Spring({
      fromValue: 0,
      toValue: 0,
      stiffness,
      damping,
    });
  }
  updateConfig(config: Partial<HarmonicMotionConfig>) {
    super.updateConfig(config);

    if (config.maxAngle !== undefined) {
      this.maxAngle = deg2rad(config.maxAngle);
    }

    if (config.stiffness !== undefined || config.damping !== undefined) {
      this.spring.updateConfig({
        ...(config.stiffness !== undefined && { stiffness: config.stiffness }),
        ...(config.damping !== undefined && { damping: config.damping }),
      });
      this.spring.start();
    }
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

  // Stops the spring's own internal RAF loop immediately, without removing
  // the onUpdate listener - used when autopilot takes over rotation so a
  // stale in-flight spring can't keep overwriting group.rotation underneath
  // it. Normal control resumes the next time update() calls spring.start().
  pause() {
    this.spring.stop();
  }

  cleanup() {
    this.spring.removeAllListeners();
  }
}
