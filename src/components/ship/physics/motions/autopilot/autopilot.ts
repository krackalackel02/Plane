import { CatmullRomCurve3, Group, MathUtils, Vector3 } from "three";
import { lerpAngle } from "../../../../../utils/3d";
import { BoardObb, clearBoardBearings } from "../../collision/boardCollision";

export type AutopilotStatus = "flying" | "arrived" | "cancelled";

// Extra clearance (world units) kept beyond a board's own half-extents
// when checking whether the straight line home would clip it. A bit more
// generous than ship/physics/collision's own SHIP_RADIUS (2), since this
// is a one-time planning check rather than a per-frame reactive nudge.
const PLANNING_CLEARANCE = 3;

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
   * Plans the flight path.
   *
   * First, if the ship's current position is "shadowed" behind some board
   * - farther from the origin than it, along that same bearing - nudge the
   * launch point sideways off that board's span (see clearBoardBearings).
   * Without this, a ship that has flown out past the board shell (fully
   * possible now that ship/physics/collision allows roaming the whole,
   * much larger world boundary) could have its own straight line home cut
   * straight through the very board it's lined up behind.
   *
   * From that cleared launch point: if it's already closer to the origin
   * than the board shell's radius, it's on the open/front-facing side of
   * every board (they all sit on that one shell facing inward), so a
   * direct path to the target is already safe. Otherwise, detour through
   * a waypoint at the origin first - a straight line from the origin to
   * any point inside the shell can never cross it, so this route can't
   * clip another board either.
   */
  start(
    from: Vector3,
    to: Vector3,
    arcRadius: number,
    boardObbs: BoardObb[],
    speed = 12,
  ) {
    const cleared = clearBoardBearings(
      { x: from.x, z: from.z },
      boardObbs,
      PLANNING_CLEARANCE,
    );
    const wasCleared = cleared.x !== from.x || cleared.z !== from.z;
    const launchPoint = wasCleared
      ? new Vector3(cleared.x, from.y, cleared.z)
      : from;

    const shipRadiusFromOrigin = Math.hypot(launchPoint.x, launchPoint.z);
    const isAlreadySafe = shipRadiusFromOrigin < arcRadius - 2;

    const waypoints: Vector3[] = [];
    if (wasCleared) waypoints.push(launchPoint);
    if (!isAlreadySafe) waypoints.push(new Vector3(0, from.y, 0));

    this.curve = new CatmullRomCurve3([
      from.clone(),
      ...waypoints,
      to.clone(),
    ]);
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
