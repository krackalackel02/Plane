import { BaseMotion, BaseMotionConfig } from "./motion";
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

  update(delta: number, activeKeys: Set<string>) {
    if (!this.group) return;
    const yaw = this.group.rotation.y || 0;

    const accel = this.acceleration || 0.01;

    // Determine movement direction based on active keys
    if (activeKeys.has(this.negativeKey)) {
      this.velocity.z -= Math.cos(yaw) * accel * delta;
      this.velocity.x -= Math.sin(yaw) * accel * delta;
    } else if (activeKeys.has(this.positiveKey)) {
      this.velocity.z += Math.cos(yaw) * accel * delta;
      this.velocity.x += Math.sin(yaw) * accel * delta;
    } else {
      // Apply decay factor if no key is pressed
      this.velocity.z *= this.decayFactor;
      this.velocity.x *= this.decayFactor;

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
