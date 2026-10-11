import { useLayoutEffect, useMemo, useRef } from "react";
import {
  Euler,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";

/**
 * One placed copy of a mesh: the planet's static props (trees, bushes, rocks,
 * mesas, ridges...) are hundreds of copies of a handful of shapes, and are
 * described as a flat list of these.
 */
export interface PropInstance {
  geometry: BufferGeometry;
  material: Material;
  /** Where this copy sits, in the planet group's own space. */
  matrix: Matrix4;
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface InstanceBatch {
  geometry: BufferGeometry;
  material: Material;
  castShadow: boolean;
  receiveShadow: boolean;
  matrices: Matrix4[];
}

/**
 * Groups instances that can be drawn together - same mesh, same material,
 * same shadow flags - preserving their order.
 */
export const batchInstances = (instances: PropInstance[]): InstanceBatch[] => {
  const batches = new Map<string, InstanceBatch>();
  for (const instance of instances) {
    const key = `${instance.geometry.uuid}|${instance.material.uuid}|${instance.castShadow}|${instance.receiveShadow}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        geometry: instance.geometry,
        material: instance.material,
        castShadow: instance.castShadow,
        receiveShadow: instance.receiveShadow,
        matrices: [],
      };
      batches.set(key, batch);
    }
    batch.matrices.push(instance.matrix);
  }
  return [...batches.values()];
};

/**
 * A part's local transform, composed exactly as a <mesh position rotation
 * scale> / <group> would be (translation x rotation x scale).
 */
export const composeMatrix = (
  position: Vector3 | [number, number, number] = [0, 0, 0],
  rotation: Quaternion | Euler | [number, number, number] = [0, 0, 0],
  scale: number | [number, number, number] = 1,
): Matrix4 => {
  const p = Array.isArray(position) ? new Vector3(...position) : position;
  const q =
    rotation instanceof Quaternion
      ? rotation
      : new Quaternion().setFromEuler(
          rotation instanceof Euler ? rotation : new Euler(...rotation),
        );
  const s =
    typeof scale === "number"
      ? new Vector3(scale, scale, scale)
      : new Vector3(...scale);
  return new Matrix4().compose(p, q, s);
};

const Batch = ({ batch }: { batch: InstanceBatch }) => {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    // Bound all the copies, not just the unit mesh at the origin, or the
    // whole batch gets frustum-culled whenever the origin is off-screen.
    mesh.computeBoundingSphere();
  }, [batch]);

  return (
    <instancedMesh
      ref={ref}
      args={[batch.geometry, batch.material, batch.matrices.length]}
      castShadow={batch.castShadow}
      receiveShadow={batch.receiveShadow}
    />
  );
};

/**
 * Draws a list of placed props as one InstancedMesh per batch (see
 * batchInstances): the GPU applies each copy's transform in its vertex
 * shader, so a few hundred trees cost one draw call rather than a few hundred
 * - and the CPU no longer walks and re-multiplies every copy's matrix each
 * frame. The props are static, so their matrices are written once.
 */
export const InstancedProps = ({
  instances,
}: {
  instances: PropInstance[];
}) => {
  const batches = useMemo(() => batchInstances(instances), [instances]);
  return (
    <>
      {batches.map((batch) => (
        <Batch
          key={`${batch.geometry.uuid}|${batch.material.uuid}|${batch.castShadow}|${batch.receiveShadow}`}
          batch={batch}
        />
      ))}
    </>
  );
};
