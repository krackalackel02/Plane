import { Group } from "three";
import { Spring } from "wobble";

export type Axis = "x" | "y" | "z";
export type MotionType = "roll" | "pitch" | "yaw" | "throttle";

export const Motion = {
  ROLL: "roll" as MotionType,
  PITCH: "pitch" as MotionType,
  YAW: "yaw" as MotionType,
  THROTTLE: "throttle" as MotionType,
};

import constants from "../../../utils/constants.json";
import { deg2rad } from "../../../utils/3d";
import keys from "../../../utils/keys.json";

interface BaseMotionConfig {
  axis?: Axis;
  positiveKey: string;
  negativeKey: string;
  rateIncrement?: number;
  maxRate?: number;
  decayFactor?: number;
}

export class BaseMotion {
  protected axis: Axis;
  protected positiveKey: string;
  protected negativeKey: string;
  protected rateIncrement: number;
  protected maxRate: number;
  protected decayFactor: number;
  protected group: Group | undefined;
  private currentRate: number;

  constructor({
    axis,
    positiveKey,
    negativeKey,
    rateIncrement = 0.1,
    maxRate = 3,
    decayFactor = 0.95,
  }: BaseMotionConfig) {
    this.axis = axis as Axis;
    this.positiveKey = positiveKey;
    this.negativeKey = negativeKey;
    this.rateIncrement = rateIncrement;
    this.maxRate = maxRate;
    this.decayFactor = decayFactor;
    this.currentRate = 0;
  }

  attachTo(group: Group) {
    this.group = group;
  }

  update(delta: number, activeKeys: Set<string>) {
    if (this.group) {
      if (activeKeys.has(this.positiveKey)) {
        this.currentRate = Math.min(
          this.currentRate + this.rateIncrement,
          this.maxRate,
        );
      } else if (activeKeys.has(this.negativeKey)) {
        this.currentRate = Math.max(
          this.currentRate - this.rateIncrement,
          -this.maxRate,
        );
      }

      this.group.rotation[this.axis] += this.currentRate * delta;

      // Decay towards zero
      if (
        !activeKeys.has(this.positiveKey) &&
        !activeKeys.has(this.negativeKey)
      ) {
        this.currentRate *= this.decayFactor;
        if (Math.abs(this.currentRate) < 0.01) this.currentRate = 0;
      }
    }
  }

  cleanup() {
    this.group = undefined;
    this.currentRate = 0;
  }
}

interface HarmonicMotionConfig extends BaseMotionConfig {
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
export class TranslationMotion extends BaseMotion {
  private velocity: { x: number; z: number } = { x: 0, z: 0 };

  constructor({ positiveKey, negativeKey }: BaseMotionConfig) {
    super({ positiveKey, negativeKey });
  }

  attachTo(group: Group) {
    this.group = group;
  }

  update(delta: number, activeKeys: Set<string>) {
    if (!this.group) return;
    const yaw = this.group.rotation.y || 0;

    const speed = this.rateIncrement * this.maxRate;

    // Determine movement direction based on active keys
    if (activeKeys.has(this.negativeKey)) {
      this.velocity.z -= Math.cos(yaw) * speed * delta;
      this.velocity.x -= Math.sin(yaw) * speed * delta;
    } else if (activeKeys.has(this.positiveKey)) {
      this.velocity.z += Math.cos(yaw) * speed * delta;
      this.velocity.x += Math.sin(yaw) * speed * delta;
    } else {
      // Apply decay factor if no key is pressed
      this.velocity.z *= this.decayFactor;
      this.velocity.x *= this.decayFactor;

      // Reset velocity if below threshold
      if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
      if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
    }

    // Apply translation to the group
    this.group.position.z += this.velocity.z;
    this.group.position.x += this.velocity.x;
  }

  cleanup() {
    this.group = undefined;
    this.velocity = { x: 0, z: 0 };
  }
}

export const createMotion = (
  type: MotionType,
): BaseMotion | HarmonicMotion | TranslationMotion => {
  const positiveKey = keys[type].positive;
  const negativeKey = keys[type].negative;

  if (type === "roll" || type === "pitch") {
    return new HarmonicMotion({
      axis: constants[type].axis as Axis,
      stiffness: constants[type].stiffness,
      damping: constants[type].damping,
      maxAngle: deg2rad(constants[type].maxAngle),
      positiveKey,
      negativeKey,
    });
  } else if (type === "yaw") {
    return new BaseMotion({
      axis: constants[type].axis as Axis,
      positiveKey,
      negativeKey,
      rateIncrement: constants[type].rateIncrement,
      maxRate: constants[type].maxRate,
      decayFactor: constants[type].decayFactor,
    });
  } else {
    return new TranslationMotion({
      positiveKey,
      negativeKey,
    });
  }
};