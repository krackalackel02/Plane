/**
 * @fileoverview
 * This file defines the TranslationMotion class, which extends BaseMotion.
 * It's responsible for managing linear (forward/backward) movement
 * for a 3D object (like a player or camera) on the XZ plane,
 * based on user input. It includes acceleration, max speed, and damping.
 */

// Import the base class and its configuration interface
import { BaseMotion, BaseMotionConfig } from "../baseMotion";

/**
 * Configuration interface for TranslationMotion.
 * Extends the base configuration with properties specific to linear movement.
 */
export interface TranslationMotionConfig extends BaseMotionConfig {
  /** The maximum speed the object can reach. */
  maxSpeed: number;
  /** The rate at which the object's speed changes (acceleration). */
  acceleration: number;
}

/**
 * Manages translational (linear) motion (e.g., forward/backward) for an object.
 *
 * This class calculates velocity changes based on key presses, applies
 * acceleration and a maximum speed limit, and handles damping (friction)
 * when no keys are pressed.
 */
export class TranslationMotion extends BaseMotion {
  // Private properties to store the motion state

  /** Current velocity of the object, broken down into x and z components. */
  private velocity: { x: number; z: number } = { x: 0, z: 0 };
  /** The maximum speed the object is allowed to reach. */
  private maxSpeed: number;
  /** The rate of acceleration when a movement key is pressed. */
  private acceleration: number;

  /**
   * Constructs a new TranslationMotion instance.
   * @param config - The configuration object for this motion.
   */
  constructor({
    positiveKey,
    negativeKey,
    decayFactor,
    maxSpeed,
    acceleration,
  }: TranslationMotionConfig) {
    // Initialize the base class
    super({ positiveKey, negativeKey, decayFactor });

    // Set properties specific to this subclass
    this.maxSpeed = maxSpeed as number;
    this.acceleration = acceleration as number;
  }

  /**
   * Dynamically updates the configuration of the motion.
   * Allows changing speed or acceleration at runtime.
   * @param config - A partial configuration object with new values.
   */
  updateConfig(config: Partial<TranslationMotionConfig>) {
    // Update base class properties (like keys or decay)
    super.updateConfig(config);

    // Update properties specific to this class, if they are provided
    if (config.acceleration !== undefined)
      this.acceleration = config.acceleration;
    if (config.maxSpeed !== undefined) this.maxSpeed = config.maxSpeed;
  }

  /**
   * The core update loop, called once per frame.
   * This method calculates and applies the new velocity and position.
   * @param delta - The time (in seconds) since the last frame.
   * @param activeKeys - A Set containing all keys currently held down.
   */
  update(delta: number, activeKeys: Set<string>) {
    // If this motion isn't attached to an object (group), do nothing.
    if (!this.group) return;

    // Get the object's current facing direction (yaw, or Y-axis rotation).
    // This is crucial for direction-relative movement (e.g., "forward").
    const yaw = this.group.rotation.y || 0;

    // Get the acceleration value, with a small default fallback.
    const accel = this.acceleration || 0.01;

    // --- 1. Calculate Acceleration based on Input ---

    // Check if the 'negative' key (e.g., 'S', 'ArrowDown') is pressed
    if (activeKeys.has(this.negativeKey)) {
      // Apply acceleration in the *opposite* direction the object is facing.
      // We use trigonometry to resolve the acceleration into X and Z components.
      // -cos(yaw) gives the Z component of the "backward" vector.
      // -sin(yaw) gives the X component of the "backward" vector.
      // We multiply by delta to make the acceleration frame-rate independent.
      this.velocity.z -= Math.cos(yaw) * accel * delta;
      this.velocity.x -= Math.sin(yaw) * accel * delta;
    }
    // Check if the 'positive' key (e.g., 'W', 'ArrowUp') is pressed
    else if (activeKeys.has(this.positiveKey)) {
      // Apply acceleration in the *same* direction the object is facing.
      // +cos(yaw) gives the Z component of the "forward" vector.
      // +sin(yaw) gives the X component of the "forward" vector.
      this.velocity.z += Math.cos(yaw) * accel * delta;
      this.velocity.x += Math.sin(yaw) * accel * delta;
    }
    // If no movement keys are pressed
    else {
      // Apply damping (friction  ) to gradually slow the object down.
      // Multiplying by a factor < 1 (e.g., 0.95) reduces the velocity each frame.
      const decayMultiplier = Math.pow(1 - this.decayFactor, delta);
      this.velocity.z *= decayMultiplier;
      this.velocity.x *= decayMultiplier;

      // To prevent infinitely small "drifting", snap velocity to 0
      // if it falls below a very small threshold.
      if (Math.abs(this.velocity.z) < 0.001) this.velocity.z = 0;
      if (Math.abs(this.velocity.x) < 0.001) this.velocity.x = 0;
    }

    // --- 2. Clamp Velocity to Max Speed ---

    const maxSpeed = this.maxSpeed;

    // Calculate the current speed (the magnitude of the velocity vector)
    // using the Pythagorean theorem: a^2 + b^2 = c^2
    const velocityMagnitude = Math.sqrt(
      this.velocity.z ** 2 + this.velocity.x ** 2,
    );

    // Check if the current speed exceeds the maximum allowed speed
    if (velocityMagnitude > maxSpeed) {
      // If it does, we need to "clamp" it.
      // We find the scaling factor needed to shrink the velocity vector
      // down to the maxSpeed while keeping its direction.
      const scale = maxSpeed / velocityMagnitude;

      // Apply the scale to both components of the velocity.
      this.velocity.z *= scale;
      this.velocity.x *= scale;
    }

    // --- 3. Apply Velocity to Position ---

    // Finally, update the object's actual position in the 3D world
    // by adding the (now calculated and clamped) velocity.
    this.group.position.z += this.velocity.z;
    this.group.position.x += this.velocity.x;
  }

  /**
   * Cleans up the motion state.
   * Resets velocity and detaches the motion from the 3D object.
   */
  cleanup() {
    this.group = undefined;
    this.velocity = { x: 0, z: 0 };
  }
}
