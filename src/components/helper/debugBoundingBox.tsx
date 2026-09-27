import React, { useEffect } from "react";
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
} from "three";
import { useDebugBounds } from "../../context/debugBoundsContext";

interface DebugBoundingBoxProps {
  // The object whose exact bounding box to trace. Left null until the
  // target has mounted (e.g. a lazy-loaded model) - the box simply stays
  // hidden until then.
  target: React.RefObject<Object3D | null>;
  color?: string;
}

// Unions every descendant mesh's geometry bounding box into `out`, all
// expressed in `root`'s OWN local space (as if root itself had an identity
// transform) rather than world space - found by stripping root's world
// matrix back out of each mesh's world matrix. This is what lets the debug
// box below rotate rigidly with its target: a world-space box has to keep
// re-expanding to stay axis-aligned as the object turns (that's what
// THREE.BoxHelper does, and why it visibly grows/shrinks instead of
// spinning with the ship), whereas a box computed once in local space and
// parented under the object just inherits its rotation for free.
const computeLocalBox = (root: Object3D, out: Box3) => {
  root.updateWorldMatrix(true, true);
  const invRootWorld = new Matrix4().copy(root.matrixWorld).invert();
  const tempBox = new Box3();
  const relativeMatrix = new Matrix4();
  out.makeEmpty();
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    mesh.geometry.computeBoundingBox();
    if (!mesh.geometry.boundingBox) return;
    tempBox.copy(mesh.geometry.boundingBox);
    relativeMatrix.multiplyMatrices(invRootWorld, mesh.matrixWorld);
    tempBox.applyMatrix4(relativeMatrix);
    out.union(tempBox);
  });
};

// Wireframe box traced around `target`'s own local-space bounds and added
// as an actual child of `target` in the scene graph - the "B" hotkey debug
// visualisation (see debugBoundsContext). Purely imperative (no per-frame
// React render): once computed, the box needs no further updates, since
// being a real child means three.js already rotates/moves it together with
// `target` on every frame as part of normal matrix-world propagation.
const DebugBoundingBox: React.FC<DebugBoundingBoxProps> = ({
  target,
  color = "#39ff14",
}) => {
  const { enabled } = useDebugBounds();

  useEffect(() => {
    if (!enabled || !target.current) return;
    const root = target.current;

    const material = new LineBasicMaterial({ color, toneMapped: false });
    const line = new LineSegments(new BufferGeometry(), material);
    root.add(line);

    const box = new Box3();
    const size = new Vector3();
    const center = new Vector3();
    let frameId = 0;
    // Some targets (e.g. a board's CSG-built frame) don't have their final
    // geometry in place on the very first frame after mount - keep
    // retrying for up to ~1s so the box still appears once it does.
    let attemptsLeft = 60;

    const tryCompute = () => {
      computeLocalBox(root, box);
      if (!box.isEmpty()) {
        box.getSize(size);
        box.getCenter(center);
        line.geometry.dispose();
        const boxGeometry = new BoxGeometry(size.x, size.y, size.z);
        line.geometry = new EdgesGeometry(boxGeometry);
        boxGeometry.dispose();
        line.position.copy(center);
        return;
      }
      if (--attemptsLeft > 0) {
        frameId = requestAnimationFrame(tryCompute);
      }
    };
    tryCompute();

    return () => {
      cancelAnimationFrame(frameId);
      root.remove(line);
      line.geometry.dispose();
      material.dispose();
    };
  }, [enabled, target, color]);

  return null;
};

export default DebugBoundingBox;
