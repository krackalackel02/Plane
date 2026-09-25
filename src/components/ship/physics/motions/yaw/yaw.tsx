import { BaseMotion, BaseMotionConfig } from "../baseMotion";

export interface YawMotionConfig extends BaseMotionConfig {
  maxSpeed: number; // Maximum yaw speed (rad/s)
  acceleration: number; // Responsiveness (1/s): how quickly currentRate closes the gap to its target
}

export class YawMotion extends BaseMotion {
  private acceleration: number;
  private maxSpeed: number;
  private currentRate: number;

  constructor({
    axis,
    positiveKey,
    negativeKey,
    acceleration = 3,
    maxSpeed = 3,
  }: YawMotionConfig) {
    super({ axis, positiveKey, negativeKey });
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
   * Updates the yaw motion based on active keys. currentRate chases a
   * target (+-maxSpeed while a key is held, 0 otherwise) via
   * BaseMotion.approach - see there for why this makes turning both settle
   * smoothly into its cap and correct quickly out of a hard turn.
   */
  update(delta: number, activeKeys: Set<string>) {
    if (!this.group) return;

    const direction = activeKeys.has(this.positiveKey)
      ? 1
      : activeKeys.has(this.negativeKey)
        ? -1
        : 0;

    this.currentRate = this.approach(
      this.currentRate,
      direction * this.maxSpeed,
      this.acceleration,
      delta,
    );
    if (direction === 0 && Math.abs(this.currentRate) < 0.001) {
      this.currentRate = 0; // Threshold to stop small oscillations
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
