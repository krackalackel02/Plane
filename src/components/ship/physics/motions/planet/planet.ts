import { Group, Quaternion, Vector3 } from "three";
import {
  alignOrientationToNormal,
  forwardOf,
} from "../../../../../utils/planetSurface";
import {
  Planet,
  getActivePlanet,
  getShellRadius,
} from "../../../../../utils/planets";

export interface AxisMotionConfig {
  acceleration: number;
  maxSpeed: number;
  decayFactor: number;
}

export interface KeyPair {
  positive: string;
  negative: string;
}

export interface PlanetMotionConfig {
  yaw: AxisMotionConfig;
  throttle: AxisMotionConfig;
}

export interface SurfaceTransform {
  position: Vector3;
  orientation: Quaternion;
}

/**
 * Drives the ship across the surface of a planet, replacing the old flat
 * TranslationMotion + YawMotion pair. Yaw turns the ship in place around
 * its own local "up" (the surface normal); throttle moves it along its own
 * local forward tangent. After each move the position is re-projected onto
 * the planet's shell and the orientation's up axis is re-aligned to the new
 * normal - the standard "walk on a sphere" trick - so turning and driving
 * forward keep composing correctly anywhere on the planet without ever
 * tracking latitude/longitude explicitly.
 *
 * Unlike the old motions, this does not write straight to a Group: it hands
 * position/orientation back from update() so Physics can layer the cosmetic
 * roll/pitch tilt on top before writing the ship's actual transform -
 * otherwise that tilt would leak back in as heading drift the next time
 * update() reads "current" orientation.
 *
 * Position is re-synced from the caller's `currentPosition` at the start of
 * every update() call rather than trusted from the last frame's own output,
 * so a post-hoc correction applied after Physics writes the transform (e.g.
 * ShipCollision bouncing the ship off a board) is picked up next frame
 * instead of being silently overwritten. Orientation has no such external
 * corrector, so it's kept as pure internal state - which is exactly what
 * keeps it free of the cosmetic tilt in the first place.
 */
export class PlanetMotion {
  private config: PlanetMotionConfig;
  private yawKeys: KeyPair;
  private throttleKeys: KeyPair;
  private planet: Planet;
  private position = new Vector3();
  private orientation = new Quaternion();
  private yawRate = 0;
  private speed = 0;

  constructor(
    config: PlanetMotionConfig,
    yawKeys: KeyPair,
    throttleKeys: KeyPair,
    planet: Planet = getActivePlanet(),
  ) {
    this.config = config;
    this.yawKeys = yawKeys;
    this.throttleKeys = throttleKeys;
    this.planet = planet;
  }

  /** Seeds internal state from wherever the group currently is (its spawn transform). */
  attachTo(group: Group) {
    this.position.copy(group.position);
    this.orientation.copy(group.quaternion);
  }

  updateConfig(config: Partial<PlanetMotionConfig>) {
    this.config = {
      yaw: { ...this.config.yaw, ...config.yaw },
      throttle: { ...this.config.throttle, ...config.throttle },
    };
  }

  update(
    delta: number,
    activeKeys: Set<string>,
    currentPosition: Vector3,
  ): SurfaceTransform {
    this.position.copy(currentPosition);
    const { yaw, throttle } = this.config;

    if (activeKeys.has(this.yawKeys.positive)) {
      this.yawRate = Math.min(
        this.yawRate + yaw.acceleration * delta,
        yaw.maxSpeed,
      );
    } else if (activeKeys.has(this.yawKeys.negative)) {
      this.yawRate = Math.max(
        this.yawRate - yaw.acceleration * delta,
        -yaw.maxSpeed,
      );
    } else {
      this.yawRate *= yaw.decayFactor;
      if (Math.abs(this.yawRate) < 0.001) this.yawRate = 0;
    }

    if (this.yawRate !== 0) {
      // Post-multiplying by a local +Y rotation turns the ship around its
      // own current up axis, whatever that is right now - an intrinsic
      // rotation, not a rotation around the world Y axis.
      this.orientation.multiply(
        new Quaternion().setFromAxisAngle(
          new Vector3(0, 1, 0),
          this.yawRate * delta,
        ),
      );
    }

    if (activeKeys.has(this.throttleKeys.positive)) {
      this.speed += throttle.acceleration * delta;
    } else if (activeKeys.has(this.throttleKeys.negative)) {
      this.speed -= throttle.acceleration * delta;
    } else {
      this.speed *= throttle.decayFactor;
      if (Math.abs(this.speed) < 0.001) this.speed = 0;
    }
    this.speed = Math.max(
      -throttle.maxSpeed,
      Math.min(throttle.maxSpeed, this.speed),
    );

    if (this.speed !== 0) {
      const forward = forwardOf(this.orientation);
      this.position.addScaledVector(forward, this.speed * delta);
    }

    const shellRadius = getShellRadius(this.planet);
    const normal = this.position.clone().sub(this.planet.center).normalize();
    this.position.copy(
      normal.clone().multiplyScalar(shellRadius).add(this.planet.center),
    );
    this.orientation = alignOrientationToNormal(this.orientation, normal);

    return { position: this.position, orientation: this.orientation };
  }

  cleanup() {
    this.yawRate = 0;
    this.speed = 0;
  }
}
