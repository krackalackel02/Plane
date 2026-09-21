import { CatmullRomCurve3, Group, MathUtils, Vector3 } from "three";
import { lerpAngle } from "../../../../../utils/3d";

export type AutopilotStatus = "flying" | "arrived" | "cancelled";

// Drives the ship along a smooth, obstacle-avoiding path to a target
// position - a standalone class rather than a BaseMotion subclass, since
// it's driven by a target position/curve rather than a single key pair.
export class AutopilotMotion {
  private curve: CatmullRomCurve3 | null = null;
  private progress = 0;
  private duration = 0;
  private group: Group | undefined;

  attachTo(group: Group) {
    this.group = group;
  }

  /**
   * Plans the flight path. If the ship is already closer to the origin than
   * the board shell's radius, it's on the open/front-facing side of every
   * board (they all sit on that one shell facing inward), so a direct path
   * is already safe. Otherwise, detour through a waypoint near the origin
   * first - a straight line from the origin to any point inside the shell
   * can never cross it, so this two-leg route can't clip another board.
   */
  start(from: Vector3, to: Vector3, arcRadius: number, speed = 12) {
    const shipRadiusFromOrigin = Math.hypot(from.x, from.z);
    const isAlreadySafe = shipRadiusFromOrigin < arcRadius - 2;

    const points = isAlreadySafe
      ? [from.clone(), to.clone()]
      : [from.clone(), new Vector3(0, from.y, 0), to.clone()];

    this.curve = new CatmullRomCurve3(points);
    this.progress = 0;
    this.duration = Math.max(this.curve.getLength() / speed, 0.1);
  }

  /**
   * Advances the flight by one frame. Returns "cancelled" the instant real
   * control input appears (manual flight always wins), "arrived" once the
   * path completes, otherwise "flying".
   */
  update(delta: number, hasManualInput: boolean): AutopilotStatus {
    if (!this.group || !this.curve) return "cancelled";
    if (hasManualInput) return "cancelled";

    this.progress = Math.min(this.progress + delta / this.duration, 1);
    const eased = MathUtils.smootherstep(this.progress, 0, 1);

    const point = this.curve.getPointAt(eased);
    const tangent = this.curve.getTangentAt(eased);

    this.group.position.copy(point);

    const targetYaw = Math.atan2(tangent.x, tangent.z);
    this.group.rotation.y = lerpAngle(this.group.rotation.y, targetYaw, 0.1);
    this.group.rotation.x = MathUtils.lerp(this.group.rotation.x, 0, 0.1);
    this.group.rotation.z = MathUtils.lerp(this.group.rotation.z, 0, 0.1);

    return this.progress >= 1 ? "arrived" : "flying";
  }

  cleanup() {
    this.group = undefined;
    this.curve = null;
  }
}
