import { BaseMotion, BaseMotionConfig } from "../baseMotion";
export interface TranslationMotionConfig extends BaseMotionConfig {
  maxSpeed: number;
  acceleration: number;
}

export class TranslationMotion extends BaseMotion {
  private velocity: { x: number; z: number } = { x: 0, z: 0 };
  private maxSpeed: number;
  private acceleration: number;

  constructor({
    positiveKey,
    negativeKey,
    decayFactor,
    maxSpeed,
    acceleration,
  }: TranslationMotionConfig) {
    super({ positiveKey, negativeKey, decayFactor });
    this.maxSpeed = maxSpeed as number;
    this.acceleration = acceleration as number;
  }

  updateConfig(config: Partial<TranslationMotionConfig>) {
    super.updateConfig(config);
    if (config.acceleration !== undefined)
      this.acceleration = config.acceleration;
    if (config.maxSpeed !== undefined) this.maxSpeed = config.maxSpeed;
  }

  update(delta: number, activeKeys: Set<string>) {
    if (!this.group) return;
    const yaw = this.group.rotation.y || 0;

    const accel = this.acceleration || 0.01;
    const forwardZ = Math.cos(yaw);
    const forwardX = Math.sin(yaw);

    // Determine movement direction based on active keys
    const direction = activeKeys.has(this.negativeKey)
      ? -1
      : activeKeys.has(this.positiveKey)
        ? 1
        : 0;

    if (direction !== 0) {
      // Ease acceleration off as speed *along the direction being held*
      // approaches maxSpeed, so cruising settles in smoothly instead of
      // slamming into the hard clamp below. Only the along-direction
      // component counts, and it's clamped to >= 0 - a fresh key press, or
      // reversing out of a drift, still gets full accel rather than being
      // eased by speed built up in the other direction.
      const alongSpeed =
        (this.velocity.z * forwardZ + this.velocity.x * forwardX) * direction;
      const approachRatio = Math.max(alongSpeed / this.maxSpeed, 0);
      const easedAccel = accel * (1 - approachRatio * approachRatio) * delta;

      this.velocity.z += forwardZ * direction * easedAccel;
      this.velocity.x += forwardX * direction * easedAccel;
    } else {
      this.velocity.z = this.decay(this.velocity.z, delta);
      this.velocity.x = this.decay(this.velocity.x, delta);

      // Reset velocity if below threshold
      if (Math.abs(this.velocity.z) < 0.001) this.velocity.z = 0;
      if (Math.abs(this.velocity.x) < 0.001) this.velocity.x = 0;
    }

    const maxSpeed = this.maxSpeed; // Replace with your desired max speed
    const velocityMagnitude = Math.sqrt(
      this.velocity.z ** 2 + this.velocity.x ** 2,
    );

    if (velocityMagnitude > maxSpeed) {
      const scale = maxSpeed / velocityMagnitude;
      this.velocity.z *= scale;
      this.velocity.x *= scale;
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
