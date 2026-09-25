import { BaseMotion, BaseMotionConfig } from "../baseMotion";
export interface TranslationMotionConfig extends BaseMotionConfig {
  maxSpeed: number;
  acceleration: number; // Responsiveness (1/s): how quickly velocity closes the gap to its target
}

export class TranslationMotion extends BaseMotion {
  private velocity: { x: number; z: number } = { x: 0, z: 0 };
  private maxSpeed: number;
  private acceleration: number;

  constructor({
    positiveKey,
    negativeKey,
    maxSpeed,
    acceleration,
  }: TranslationMotionConfig) {
    super({ positiveKey, negativeKey });
    this.maxSpeed = maxSpeed as number;
    this.acceleration = acceleration as number;
  }

  updateConfig(config: Partial<TranslationMotionConfig>) {
    super.updateConfig(config);
    if (config.acceleration !== undefined)
      this.acceleration = config.acceleration;
    if (config.maxSpeed !== undefined) this.maxSpeed = config.maxSpeed;
  }

  /**
   * velocity chases a target vector - heading * maxSpeed while throttle is
   * held, zero otherwise - via BaseMotion.approach. Because the target
   * rotates with the ship's current heading, holding throttle through a
   * turn actively pulls velocity onto the new heading instead of just
   * adding to whatever direction the ship happened to be drifting in, and
   * releasing (or reversing) throttle corrects just as fast as building
   * speed up did. The target is already bounded by maxSpeed and approach()
   * never overshoots it, so no separate clamp is needed.
   */
  update(delta: number, activeKeys: Set<string>) {
    if (!this.group) return;
    const yaw = this.group.rotation.y || 0;
    const forwardZ = Math.cos(yaw);
    const forwardX = Math.sin(yaw);

    // Determine movement direction based on active keys
    const direction = activeKeys.has(this.negativeKey)
      ? -1
      : activeKeys.has(this.positiveKey)
        ? 1
        : 0;

    this.velocity.z = this.approach(
      this.velocity.z,
      forwardZ * direction * this.maxSpeed,
      this.acceleration,
      delta,
    );
    this.velocity.x = this.approach(
      this.velocity.x,
      forwardX * direction * this.maxSpeed,
      this.acceleration,
      delta,
    );

    if (direction === 0) {
      // Reset velocity if below threshold
      if (Math.abs(this.velocity.z) < 0.001) this.velocity.z = 0;
      if (Math.abs(this.velocity.x) < 0.001) this.velocity.x = 0;
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
