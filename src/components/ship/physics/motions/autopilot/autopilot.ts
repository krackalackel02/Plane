import { MathUtils, Vector3 } from "three";
import {
  angleBetween,
  buildSurfaceOrientation,
  slerpOnSphere,
} from "../../../../../utils/planetSurface";
import {
  Planet,
  getActivePlanet,
  getShellRadius,
} from "../../../../../utils/planets";
import { SurfaceTransform } from "../planet/planet";

export type AutopilotStatus = "flying" | "arrived" | "cancelled";

export interface AutopilotResult extends SurfaceTransform {
  status: AutopilotStatus;
}

/**
 * Drives the ship along a great-circle arc, at a constant altitude above
 * the planet, to a target point on its shell. A standalone class rather
 * than a PlanetMotion subclass, since it's driven by a target position
 * rather than key input.
 *
 * Slerping the two (normalized) endpoint directions keeps every point on
 * the path at exactly the shell radius throughout - unlike a straight
 * Euclidean line between two widely separated surface points, which can
 * dip below the surface, this can never clip through the planet, so no
 * origin-detour heuristic is needed (as the old flat-world version had).
 */
export class AutopilotMotion {
  private from = new Vector3();
  private to = new Vector3();
  private progress = 0;
  private duration = 0;
  private planet: Planet = getActivePlanet();
  private started = false;
  private current: SurfaceTransform = this.transformAt(0);

  start(
    from: Vector3,
    to: Vector3,
    speed = 12,
    planet: Planet = getActivePlanet(),
  ) {
    this.planet = planet;
    const shellRadius = getShellRadius(planet);
    const project = (p: Vector3) =>
      p
        .clone()
        .sub(planet.center)
        .normalize()
        .multiplyScalar(shellRadius)
        .add(planet.center);

    this.from = project(from);
    this.to = project(to);

    const angle = angleBetween(
      this.from.clone().sub(planet.center),
      this.to.clone().sub(planet.center),
    );
    this.duration = Math.max((angle * shellRadius) / speed, 0.1);
    this.progress = 0;
    this.started = true;
    this.current = this.transformAt(0);
  }

  /** Position + facing at a given point (0-1) along the arc. */
  private transformAt(eased: number): SurfaceTransform {
    const center = this.planet.center;
    const shellRadius = getShellRadius(this.planet);
    const a = this.from.clone().sub(center);
    const b = this.to.clone().sub(center);
    const toWorld = (t: number) =>
      slerpOnSphere(a, b, t).multiplyScalar(shellRadius).add(center);

    const point = toWorld(eased);
    // Finite-difference tangent for heading - accurate enough at these
    // frame-to-frame step sizes and avoids a separate closed-form
    // derivative of the slerp formula. Falls back to looking behind near
    // the very end of the arc, where "ahead" would otherwise land on top
    // of the point itself.
    let forwardHint = toWorld(Math.min(eased + 0.01, 1)).sub(point);
    if (forwardHint.lengthSq() < 1e-8) {
      forwardHint = point.clone().sub(toWorld(Math.max(eased - 0.01, 0)));
    }

    const normal = point.clone().sub(center).normalize();
    const orientation = buildSurfaceOrientation(normal, forwardHint);
    return { position: point, orientation };
  }

  /**
   * Advances the flight by one frame. Returns "cancelled" the instant real
   * control input appears (manual flight always wins) - the returned
   * position/orientation is left exactly where the ship already was, so
   * Physics can hand control back without a visible jump. Returns "arrived"
   * once the path completes, otherwise "flying".
   */
  update(delta: number, hasManualInput: boolean): AutopilotResult {
    if (!this.started || hasManualInput) {
      this.started = false;
      return { status: "cancelled", ...this.current };
    }

    this.progress = Math.min(this.progress + delta / this.duration, 1);
    const eased = MathUtils.smootherstep(this.progress, 0, 1);
    this.current = this.transformAt(eased);

    return {
      status: this.progress >= 1 ? "arrived" : "flying",
      ...this.current,
    };
  }

  cleanup() {
    this.started = false;
  }
}
