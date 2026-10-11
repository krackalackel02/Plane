import { describe, expect, test } from "vitest";
import { Group, Object3D, Quaternion, Vector3 } from "three";
import { applyShipPose } from "./shipPose";

// The scene's own hierarchy (see ship/index.tsx and camera/index.tsx): the
// chase camera is a child of the ship's frame; the body sits inside the
// attitude group beside it.
const build = () => {
  const ship = new Group();
  const attitude = new Group();
  const body = new Object3D();
  const camera = new Object3D();
  ship.add(attitude);
  attitude.add(body);
  ship.add(camera);
  camera.position.set(0, 2, -6); // behind and above, like a chase camera
  return { ship, attitude, body, camera };
};

const position = new Vector3(3, 41, -2);
const heading = new Quaternion().setFromAxisAngle(
  new Vector3(0.3, 1, 0.2).normalize(),
  0.8,
);

const worldPose = (object: Object3D) => {
  object.updateWorldMatrix(true, false);
  return {
    position: object.getWorldPosition(new Vector3()),
    quaternion: object.getWorldQuaternion(new Quaternion()),
  };
};

describe("applyShipPose", () => {
  // The bug: the roll went onto the ship's own frame, so the camera riding on
  // it swung round the ship - and the planet appeared to spin - mid-trick.
  test("a barrel roll leaves the camera exactly where it was", () => {
    const { ship, attitude, camera } = build();
    applyShipPose(ship, attitude, position, heading, 0, 0);
    const level = worldPose(camera);

    for (const roll of [Math.PI / 3, Math.PI / 2, Math.PI, 1.6 * Math.PI]) {
      applyShipPose(ship, attitude, position, heading, 0.2, roll);
      const rolled = worldPose(camera);
      expect(rolled.position.distanceTo(level.position)).toBeLessThan(1e-9);
      // angleTo goes through acos, which turns rounding noise into ~1e-8 rad.
      expect(rolled.quaternion.angleTo(level.quaternion)).toBeLessThan(1e-6);
    }
  });

  test("the body spins about the ship's own nose, staying in place", () => {
    const { ship, attitude, body } = build();
    applyShipPose(ship, attitude, position, heading, 0, Math.PI / 2);
    const { position: at, quaternion } = worldPose(body);

    // Still at the ship's position - spinning on its own axis, not orbiting.
    expect(at.distanceTo(position)).toBeLessThan(1e-9);
    // Its nose (local +Z) still points along the heading...
    const nose = new Vector3(0, 0, 1).applyQuaternion(quaternion);
    const headingNose = new Vector3(0, 0, 1).applyQuaternion(heading);
    expect(nose.angleTo(headingNose)).toBeLessThan(1e-6);
    // ...while its up has turned a quarter of the way round that axis.
    const up = new Vector3(0, 1, 0).applyQuaternion(quaternion);
    const headingUp = new Vector3(0, 1, 0).applyQuaternion(heading);
    expect(up.angleTo(headingUp)).toBeCloseTo(Math.PI / 2, 9);
  });

  test("the ship's own frame holds only the heading", () => {
    const { ship, attitude } = build();
    applyShipPose(ship, attitude, position, heading, 0.3, 2.1);
    expect(ship.position.distanceTo(position)).toBeLessThan(1e-12);
    expect(ship.quaternion.angleTo(heading)).toBeLessThan(1e-6);
  });
});
