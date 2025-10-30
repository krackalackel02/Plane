import { Group } from "three";

// BaseMotion class to be extended by specific motion implementations
import { AxisType } from "../../../types/types";
import { log } from "../../../../utils/common";

/**
 * Configuration interface for BaseMotion
 * Includes optional axis, positive and negative keys, and decay factor
 * @property {AxisType} [axis] - Axis of motion
 * @property {string} positiveKey - Key for positive direction
 * @property {string} negativeKey - Key for negative direction
 * @property {number} [decayFactor] - Decay factor for motion
 */
export interface BaseMotionConfig {
  axis?: AxisType;
  positiveKey: string;
  negativeKey: string;
  decayFactor?: number;
}

/**
 * BaseMotion class
 * Provides foundational functionality for motion behaviors
 * @class BaseMotion
 * @property {AxisType} axis - Axis of motion
 * @property {string} positiveKey - Key for positive direction
 * @property {string} negativeKey - Key for negative direction
 * @property {number} decayFactor - Decay factor for motion
 * @property {Group | undefined} group - Three.js Group to which the motion is applied
 * @method attachTo - Attaches the motion to a Three.js Group
 * @method update - Updates the motion based on delta time and active keys
 * @method updateConfig - Updates the motion configuration
 * @method cleanup - Cleans up references to the Group
 */
export class BaseMotion {
  protected axis: AxisType;
  protected positiveKey: string;
  protected negativeKey: string;
  protected decayFactor: number;
  protected group: Group | undefined;

  /**
   * Creates an instance of BaseMotion.
   * @param {BaseMotionConfig} config - Configuration object for the motion
   */
  constructor({
    axis,
    positiveKey,
    negativeKey,
    decayFactor = 0.95,
  }: BaseMotionConfig) {
    this.axis = axis as AxisType;
    this.positiveKey = positiveKey;
    this.negativeKey = negativeKey;
    this.decayFactor = decayFactor;
  }

  /**
   * Attaches the motion to a Three.js Group.
   * @param group - The Three.js Group to attach the motion to.
   */
  attachTo(group: Group) {
    this.group = group;
  }

  /**
   * Updates the motion based on delta time and active keys.
   * @param delta - The time delta since the last update.
   * @param activeKeys - The set of currently active input keys.
   */
  update(delta: number, activeKeys: Set<string>) {
    log("BaseMotion update", delta, activeKeys);
  }

  /**
   * Updates the motion configuration.
   * @param config - Partial configuration object to update the motion.
   */
  updateConfig(config: Partial<BaseMotionConfig>) {
    if (config.axis !== undefined) this.axis = config.axis;
    if (config.positiveKey !== undefined) this.positiveKey = config.positiveKey;
    if (config.negativeKey !== undefined) this.negativeKey = config.negativeKey;
    if (config.decayFactor !== undefined) this.decayFactor = config.decayFactor;
  }

  /**
   * Cleans up references to the Group.
   * @returns {void}
   */
  cleanup() {
    this.group = undefined;
  }
}
