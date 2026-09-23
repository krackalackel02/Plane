import React, { useRef } from "react";
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

import { smoothstep } from "../../../../utils/3d";
import { useExhaustSimulation } from "../useExhaustSimulation";
import { matteColorMap } from "../colorMaps";
import { ExhaustRendererProps } from "../types";
import { voxelVertexShader, voxelFragmentShader } from "./voxelMaterial";

// How many small cubes make up one puff - kept low since each puff's voxels
// are simulated and drawn every frame.
const VOXELS_PER_PUFF = 5;
const VOXEL_SIZE = 0.28;
const SPIN_SPEED = 6;

// Random direction uniformly distributed on the unit sphere.
const randomOnSphere = (out: Vector3) => {
  const z = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  out.set(r * Math.cos(theta), r * Math.sin(theta), z);
  return out;
};

/**
 * "voxels" mode: each simulated puff is a small cluster of cubes that burst
 * outward from the emission point and tumble as they go, shrinking and
 * fading with age - a true 3D, particle-rig-style cloud rather than a
 * billboarded blob.
 */
const VoxelRenderer: React.FC<ExhaustRendererProps> = ({
  active,
  position,
  count = 40,
  coneAngle = Math.PI / 6,
  decaySpeed = 0.01,
  speedDecay = 0.98,
  reverse = false,
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const totalVoxels = count * VOXELS_PER_PUFF;

  // Per-voxel scatter state, (re)assigned whenever its parent puff spawns.
  const directions = useRef(new Float32Array(totalVoxels * 3));
  const spinAxes = useRef(new Float32Array(totalVoxels * 3));
  const spinRates = useRef(new Float32Array(totalVoxels));
  const sizeJitter = useRef(new Float32Array(totalVoxels).fill(1));
  const radiusJitter = useRef(new Float32Array(totalVoxels).fill(1));
  const voxelAlphas = useRef(new Float32Array(totalVoxels));
  const voxelColors = useRef(new Float32Array(totalVoxels * 3));

  // Scratch objects reused every frame to avoid per-instance allocation.
  const tmpDir = useRef(new Vector3());
  const tmpAxis = useRef(new Vector3());
  const tmpPosition = useRef(new Vector3());
  const tmpQuaternion = useRef(new Quaternion());
  const tmpScale = useRef(new Vector3());
  const tmpMatrix = useRef(new Matrix4());

  useExhaustSimulation({
    active,
    count,
    coneAngle,
    decaySpeed,
    speedDecay,
    reverse,
    colorMap: matteColorMap,
    onStep: (state, spawnedIndex) => {
      const mesh = meshRef.current;
      if (!mesh) return;

      if (spawnedIndex !== null) {
        for (let v = 0; v < VOXELS_PER_PUFF; v++) {
          const gi = spawnedIndex * VOXELS_PER_PUFF + v;
          randomOnSphere(tmpDir.current);
          directions.current.set(tmpDir.current.toArray(), gi * 3);
          randomOnSphere(tmpAxis.current);
          spinAxes.current.set(tmpAxis.current.toArray(), gi * 3);
          spinRates.current[gi] = SPIN_SPEED * (0.5 + Math.random());
          sizeJitter.current[gi] = 0.6 + Math.random() * 0.7;
          radiusJitter.current[gi] = 0.7 + Math.random() * 0.6;
        }
      }

      for (let i = 0; i < count; i++) {
        const lifetime = state.lifetimes[i];
        const puffIdx = i * 3;

        for (let v = 0; v < VOXELS_PER_PUFF; v++) {
          const gi = i * VOXELS_PER_PUFF + v;

          if (lifetime <= 0) {
            voxelAlphas.current[gi] = 0;
            continue;
          }

          const age = 1 - lifetime; // 0 at spawn -> 1 at death

          // Burst outward (ease-out) then keep drifting - "disperse" reads
          // as the cluster spreading wider, not just shrinking in place.
          const spread = 1 - Math.pow(1 - age, 3);
          const radius = (0.05 + spread * 1.6) * radiusJitter.current[gi];

          const dgi = gi * 3;
          tmpPosition.current.set(
            state.positions[puffIdx] + directions.current[dgi] * radius,
            state.positions[puffIdx + 1] + directions.current[dgi + 1] * radius,
            state.positions[puffIdx + 2] + directions.current[dgi + 2] * radius,
          );

          const shrink = 1 - smoothstep(0.25, 1, age) * 0.8;
          const scale = VOXEL_SIZE * sizeJitter.current[gi] * shrink;
          tmpScale.current.set(scale, scale, scale);

          tmpAxis.current.set(
            spinAxes.current[dgi],
            spinAxes.current[dgi + 1],
            spinAxes.current[dgi + 2],
          );
          tmpQuaternion.current.setFromAxisAngle(
            tmpAxis.current,
            age * spinRates.current[gi],
          );

          tmpMatrix.current.compose(
            tmpPosition.current,
            tmpQuaternion.current,
            tmpScale.current,
          );
          mesh.setMatrixAt(gi, tmpMatrix.current);

          const fadeIn = smoothstep(0, 0.05, age);
          const fadeOut = 1 - smoothstep(0.5, 1, age);
          voxelAlphas.current[gi] = fadeIn * fadeOut;
          voxelColors.current.set(
            [
              state.colors[puffIdx],
              state.colors[puffIdx + 1],
              state.colors[puffIdx + 2],
            ],
            gi * 3,
          );
        }
      }

      mesh.instanceMatrix.needsUpdate = true;
      const { attributes } = mesh.geometry;
      (attributes.voxelAlpha.array as Float32Array).set(voxelAlphas.current);
      (attributes.voxelColor.array as Float32Array).set(voxelColors.current);
      attributes.voxelAlpha.needsUpdate = true;
      attributes.voxelColor.needsUpdate = true;
    },
  });

  return (
    <group position={position}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, totalVoxels]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]}>
          <instancedBufferAttribute
            attach="attributes-voxelAlpha"
            array={new Float32Array(totalVoxels)}
            count={totalVoxels}
            itemSize={1}
          />
          <instancedBufferAttribute
            attach="attributes-voxelColor"
            array={new Float32Array(totalVoxels * 3)}
            count={totalVoxels}
            itemSize={3}
          />
        </boxGeometry>
        <shaderMaterial
          vertexShader={voxelVertexShader}
          fragmentShader={voxelFragmentShader}
          transparent
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
};

export default VoxelRenderer;
