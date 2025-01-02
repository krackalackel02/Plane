import { BaseMotion, BaseMotionConfig } from "./motion";

export interface YawMotionConfig extends BaseMotionConfig {
  maxRate: number;
  rateIncrement: number;
}

export class YawMotion extends BaseMotion {
  protected rateIncrement: number;
  protected maxRate: number;
  private currentRate: number;

  constructor({
    axis,
    positiveKey,
    negativeKey,
    rateIncrement = 0.1,
    maxRate = 3,
    decayFactor = 0.95,
  }: YawMotionConfig) {
    super({ axis, positiveKey, negativeKey, decayFactor });
    this.rateIncrement = rateIncrement;
    this.maxRate = maxRate;
    this.decayFactor = decayFactor;
    this.currentRate = 0;
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
