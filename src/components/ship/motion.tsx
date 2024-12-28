import { Group } from "three";
import { Spring } from "wobble";
type Axis = "x" | "y" | "z";

interface BaseMotionConfig {
  axis: Axis;
  positiveKey: string;
  negativeKey: string;
  rateIncrement?: number; // Increment per frame for angular velocity
  maxRate?: number; // Maximum angular velocity
  decayFactor?: number; // Decay factor for slowing down
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
    this.axis = axis;
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

  update(delta: number) {
    if (this.group) {
      // Apply angular velocity
      this.group.rotation[this.axis] += this.currentRate * delta;

      // Decay towards zero when no key is pressed
      if (this.currentRate !== 0) {
        this.currentRate *= this.decayFactor;
        if (Math.abs(this.currentRate) < 0.01) this.currentRate = 0; // Stop small oscillations
      }
    }
  }

  handleKeyDown(e: KeyboardEvent) {
    if (e.key === this.positiveKey) {
      this.currentRate = Math.min(
        this.currentRate + this.rateIncrement,
        this.maxRate,
      );
    } else if (e.key === this.negativeKey) {
      this.currentRate = Math.max(
        this.currentRate - this.rateIncrement,
        -this.maxRate,
      );
    }
  }

  handleKeyUp(e: KeyboardEvent) {
    // Let decay handle returning to zero
    e.preventDefault();
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

    // Initialize spring
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

  handleKeyDown(e: KeyboardEvent) {
    if (e.key === this.positiveKey) {
      this.spring.updateConfig({ toValue: this.maxAngle });
      this.spring.start();
    }
    if (e.key === this.negativeKey) {
      this.spring.updateConfig({ toValue: -this.maxAngle });
      this.spring.start();
    }
  }

  handleKeyUp(e: KeyboardEvent) {
    if (e.key === this.positiveKey || e.key === this.negativeKey) {
      this.spring.updateConfig({ toValue: 0 });
      this.spring.start();
    }
  }

  cleanup() {
    this.spring.removeAllListeners();
  }
}
