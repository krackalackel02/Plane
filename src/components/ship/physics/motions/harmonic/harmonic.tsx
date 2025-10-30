/**
 * @fileoverview
 * This file defines the HarmonicMotion class, which extends BaseMotion.
 * It's responsible for managing rotational movement (like tilting or leaning)
 * for a 3D object using a spring-based physics model.
 * This creates a smooth, "bouncy," or "wobbly" effect when keys are
 * pressed and released, rather than a rigid, instant rotation.
 */

// --- Imports ---

import { Group } from "three"; // Used to type the 3D object this motion controls
import { Spring } from "wobble"; // The core spring physics library
import { BaseMotion, BaseMotionConfig } from "../baseMotion"; // The base class
import { deg2rad } from "../../../../../utils/3d"; // Utility to convert degrees to radians

// --- Configuration ---

/**
 * Configuration interface for HarmonicMotion.
 * Extends the base configuration with properties needed for spring physics.
 */
export interface HarmonicMotionConfig extends BaseMotionConfig {
  /** The "bounciness" or "strength" of the spring. Higher = more bouncy. */
  stiffness: number;
  /** The "friction" or "resistance" of the spring. Higher = less oscillation. */
  damping: number;
  /** The maximum angle (in degrees) the object can tilt to. */
  maxAngle: number;
}

// --- Class Definition ---

/**
 * Manages harmonic (spring-based) rotational motion for an object.
 *
 * This class uses a Spring simulation to smoothly animate an object's
 * rotation on a specific axis (e.g., 'x' for pitch, 'z' for roll)
 * towards a target value. When a key is pressed, the target is set to
 * `maxAngle`. When released, the target is set back to 0, and the spring
 * physics handles the smooth return and any "overshoot" or "wobble."
 */
export class HarmonicMotion extends BaseMotion {
  /** The underlying spring physics instance from the 'wobble' library. */
  private spring: Spring;
  /** The maximum rotation angle, stored in radians for 'three.js'. */
  private maxAngle: number;

  /**
   * Constructs a new HarmonicMotion instance.
   * @param config - The configuration object for this motion.
   */
  constructor({
    axis,
    stiffness,
    damping,
    maxAngle,
    positiveKey,
    negativeKey,
  }: HarmonicMotionConfig) {
    // Initialize the base class with axis and keys
    super({ axis, positiveKey, negativeKey });

    // Convert the maxAngle from degrees (user-friendly) to radians (math-friendly)
    this.maxAngle = deg2rad(maxAngle);

    // Initialize the spring.
    // It starts at 0 and is set to move towards 0 (i.e., at rest).
    this.spring = new Spring({
      fromValue: 0, // The starting value (at rest)
      toValue: 0, // The target value (also at rest)
      stiffness, // Spring "strength"
      damping, // Spring "friction"
    });
  }

  /**
   * Dynamically updates the configuration of the motion.
   * Allows changing spring physics or max angle at runtime.
   * @param config - A partial configuration object with new values.
   */
  updateConfig(config: Partial<HarmonicMotionConfig>) {
    // Update base properties (like keys or axis)
    super.updateConfig(config);

    // If maxAngle is provided, update it (and convert to radians)
    if (config.maxAngle !== undefined) {
      this.maxAngle = deg2rad(config.maxAngle);
    }

    // If spring physics properties are provided, update the spring
    if (config.stiffness !== undefined || config.damping !== undefined) {
      this.spring.updateConfig({
        // Use spread syntax to conditionally add properties if they exist
        ...(config.stiffness !== undefined && { stiffness: config.stiffness }),
        ...(config.damping !== undefined && { damping: config.damping }),
      });
      // Start the spring to ensure it re-evaluates with the new physics
      this.spring.start();
    }
  }

  /**
   * Attaches the motion to a 3D object (Group) and connects the spring.
   * This is separate from the constructor to allow for flexibility.
   * @param group - The 'three' Group to which this motion will apply rotation.
   */
  attachTo(group: Group) {
    // Set up the spring's "onUpdate" listener.
    // This callback runs every time the spring's value changes (i.e., every frame
    // it's in motion).
    this.spring.onUpdate((state) => {
      // Apply the spring's current value directly to the object's rotation
      // on the specified axis (e.g., group.rotation.x = -0.123...)
      group.rotation[this.axis] = state.currentValue;
    });
  }

  /**
   * The core update loop, called once per frame.
   * This method checks for input and sets the *target* for the spring.
   * @param _delta - The time since the last frame (not used here, as the spring handles its own time).
   * @param activeKeys - A Set containing all keys currently held down.
   */
  update(_delta: number, activeKeys: Set<string>) {
    // Check if the 'positive' key is pressed
    if (activeKeys.has(this.positiveKey)) {
      // Set the spring's target value to the positive max angle
      this.spring.updateConfig({ toValue: this.maxAngle });
      // "Wake up" the spring to start moving towards the new target
      this.spring.start();
    }
    // Check if the 'negative' key is pressed
    else if (activeKeys.has(this.negativeKey)) {
      // Set the spring's target value to the negative max angle
      this.spring.updateConfig({ toValue: -this.maxAngle });
      // "Wake up" the spring
      this.spring.start();
    }
    // If neither key is pressed
    else {
      // Set the spring's target back to 0 (the resting position)
      this.spring.updateConfig({ toValue: 0 });
      // "Wake up" the spring to start returning to rest
      this.spring.start();
    }
  }

  /**
   * Cleans up the motion state.
   * Removes all event listeners from the spring to prevent memory leaks.
   */
  cleanup() {
    this.spring.removeAllListeners();
  }
}
