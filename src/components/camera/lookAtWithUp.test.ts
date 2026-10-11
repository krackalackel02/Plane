import { describe, test, expect } from "vitest";
import * as THREE from "three";
import { lookAtWithUp } from "./lookAtWithUp";

describe("lookAtWithUp", () => {
  test("with no parent, rolls the camera so worldUp reads as vertical", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);

    lookAtWithUp(
      camera,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
    );

    // Camera's local +Y should end up aligned with the requested world up.
    const renderedUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
      camera.quaternion,
    );
    expect(renderedUp.distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(
      1e-5,
    );
  });

  // Regression test: this is the actual bug being fixed. The ship's own up
  // is the local planet-surface normal, which is essentially never world
  // +Y - a plain camera.lookAt() (which always rolls against camera.up,
  // left at the world +Y default) renders the ship banked/rolled instead
  // of level as soon as the ship's up diverges from world +Y.
  test("rolls correctly when worldUp is not world +Y (e.g. the ship's own up on a sphere)", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 0, 0);
    const shipUp = new THREE.Vector3(0, 0, 1); // e.g. the ship's home spawn up

    lookAtWithUp(camera, new THREE.Vector3(0, 0, 0), shipUp);

    const renderedUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
      camera.quaternion,
    );
    expect(renderedUp.distanceTo(shipUp)).toBeLessThan(1e-5);
  });

  test("accounts for a rotated parent - resulting local quaternion still rolls to worldUp once composed with the parent", () => {
    const parent = new THREE.Object3D();
    // Parent (e.g. the ship) rotated 90deg about X, so its own local up
    // points along world +Z rather than world +Y.
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    parent.updateMatrixWorld(true);

    const camera = new THREE.PerspectiveCamera();
    // Local offset with no z component, so after the parent's 90deg X
    // rotation the camera's world Y lands at 0 - keeping worldUp (0,1,0)
    // exactly perpendicular to the view direction below, which lookAt's
    // basis construction requires for an exact result (it otherwise
    // projects `up` onto the plane perpendicular to the view direction
    // rather than reproducing it exactly).
    camera.position.set(0, 5, 0);
    parent.add(camera);
    parent.updateMatrixWorld(true);

    const worldTarget = new THREE.Vector3(100, 0, 0);
    const worldUp = new THREE.Vector3(0, 1, 0);
    lookAtWithUp(camera, worldTarget, worldUp);
    parent.updateMatrixWorld(true);

    const renderedWorldUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(camera.quaternion)
      .applyQuaternion(parent.quaternion);
    expect(renderedWorldUp.distanceTo(worldUp)).toBeLessThan(1e-5);

    const worldPosition = camera.getWorldPosition(new THREE.Vector3());
    const forward = worldTarget.clone().sub(worldPosition).normalize();
    const renderedForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .applyQuaternion(parent.quaternion);
    expect(renderedForward.distanceTo(forward)).toBeLessThan(1e-5);
  });
});
