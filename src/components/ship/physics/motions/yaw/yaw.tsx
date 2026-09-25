import { BaseMotion, BaseMotionConfig } from "../baseMotion";

export interface YawMotionConfig extends BaseMotionConfig {
  maxSpeed: number; // Maximum yaw speed
  acceleration: number; // Acceleration for yaw
}

export class YawMotion extends BaseMotion {
  private acceleration: number;
  private maxSpeed: number;
  private currentRate: number;

  constructor({
    axis,
    positiveKey,
    negativeKey,
    acceleration = 0.01,
    maxSpeed = 3,
    decayFactor = 0.95,
  }: YawMotionConfig) {
    super({ axis, positiveKey, negativeKey, decayFactor });
    this.acceleration = acceleration;
    this.maxSpeed = maxSpeed;
    this.currentRate = 0;
  }

  /**
   * Updates the configuration of the motion dynamically.
   */
  updateConfig(config: Partial<YawMotionConfig>) {
    super.updateConfig(config);
    if (config.acceleration !== undefined)
      this.acceleration = config.acceleration;
    if (config.maxSpeed !== undefined) this.maxSpeed = config.maxSpeed;
  }

  /**
   * Updates the yaw motion based on active keys.
   */
  update(delta: number, activeKeys: Set<string>) {
    if (!this.group) return;

    // Determine direction and apply acceleration, easing off as the rate
    // approaches maxSpeed in that direction (see TranslationMotion for why)
    // so turning settles into its cap instead of hitting it abruptly.
    if (activeKeys.has(this.positiveKey)) {
      const approachRatio = Math.max(this.currentRate / this.maxSpeed, 0);
      const eased = this.acceleration * (1 - approachRatio * approachRatio);
      this.currentRate = Math.min(
        this.currentRate + eased * delta,
        this.maxSpeed,
      );
    } else if (activeKeys.has(this.negativeKey)) {
      const approachRatio = Math.max(-this.currentRate / this.maxSpeed, 0);
      const eased = this.acceleration * (1 - approachRatio * approachRatio);
      this.currentRate = Math.max(
        this.currentRate - eased * delta,
        -this.maxSpeed,
      );
    } else {
      this.currentRate = this.decay(this.currentRate, delta);
      if (Math.abs(this.currentRate) < 0.01) this.currentRate = 0; // Threshold to stop small oscillations
    }

    // Apply yaw rotation to the group
    this.group.rotation[this.axis] += this.currentRate * delta;
  }

  /**
   * Cleans up the motion by resetting state.
   */
  cleanup() {
    this.group = undefined;
    this.currentRate = 0;
  }
}
