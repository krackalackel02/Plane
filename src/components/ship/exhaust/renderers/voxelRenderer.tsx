import React, { useRef } from "react";
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

import { smoothstep } from "../../../../utils/3d";
import { useExhaustSimulation } from "../useExhaustSimulation";
import { matteColorMap } from "../colorMaps";
import { ExhaustRendererProps } from "../types";
import { voxelVertexShader, voxelFragmentShader } from "./voxelMaterial";

// Cube offsets, on a unit grid, that approximate a rounded ball: the centre
// cell plus every face- and edge-adjacent cell, skipping the 8 corners
// (which have all three axes non-zero) so the silhouette reads as round
// rather than boxy. 19 cubes per puff.
const LATTICE_OFFSETS: [number, number, number][] = [];
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      const axesUsed = Number(x !== 0) + Number(y !== 0) + Number(z !== 0);
      if (axesUsed <= 2) LATTICE_OFFSETS.push([x, y, z]);
    }
  }
}
const VOXELS_PER_PUFF = LATTICE_OFFSETS.length;

const VOXEL_SIZE = 0.26;
const CLUSTER_SPACING = 0.22; // > voxel size would leave gaps at spawn; this overlaps them into a solid-looking ball
const MAX_SPREAD = 4; // how many times wider the lattice gets by end of life

// Random direction uniformly distributed on the unit sphere.
const randomOnSphere = (out: Vector3) => {
  const z = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  out.set(r * Math.cos(theta), r * Math.sin(theta), z);
  return out;
};

// A uniform-random rotation (Shoemake's method).
const randomQuaternion = (out: Quaternion) => {
  const u1 = Math.random();
  const u2 = Math.random();
  const u3 = Math.random();
  const s1 = Math.sqrt(1 - u1);
  const s2 = Math.sqrt(u1);
  out.set(
    s1 * Math.sin(2 * Math.PI * u2),
    s1 * Math.cos(2 * Math.PI * u2),
    s2 * Math.sin(2 * Math.PI * u3),
    s2 * Math.cos(2 * Math.PI * u3),
  );
  return out;
};

/**
 * "voxels" mode: each simulated puff is a rigid ball built out of small
 * cubes (see LATTICE_OFFSETS) rather than a billboarded blob. The whole
 * ball tumbles together and, as it ages, its cubes drift apart (spacing
 * grows) and shrink/fade - "disperse" reads as the ball coming apart and
 * dissolving, not individual embers flying off.
 */
const VoxelRenderer: React.FC<ExhaustRendererProps> = ({
  active,
  position,
  count = 30,
  coneAngle = Math.PI / 6,
  decaySpeed = 0.01,
  speedDecay = 0.98,
  reverse = false,
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const totalVoxels = count * VOXELS_PER_PUFF;

  // Per-puff rigid-body state, (re)assigned whenever that puff spawns.
  const orientations = useRef(new Float32Array(count * 4)); // quaternion xyzw
  const spinAxes = useRef(new Float32Array(count * 3));
  const spinRates = useRef(new Float32Array(count));
  const sizeJitter = useRef(new Float32Array(count).fill(1));

  const voxelAlphas = useRef(new Float32Array(totalVoxels));
  const voxelColors = useRef(new Float32Array(totalVoxels * 3));

  // Scratch objects reused every frame/instance to avoid allocation.
  const tmpAxis = useRef(new Vector3());
  const tmpOrientation = useRef(new Quaternion());
  const tmpSpin = useRef(new Quaternion());
  const tmpOffset = useRef(new Vector3());
  const tmpPosition = useRef(new Vector3());
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
        randomQuaternion(tmpOrientation.current);
        orientations.current.set(
          tmpOrientation.current.toArray(),
          spawnedIndex * 4,
        );
        randomOnSphere(tmpAxis.current);
        spinAxes.current.set(tmpAxis.current.toArray(), spawnedIndex * 3);
        spinRates.current[spawnedIndex] = 1.5 + Math.random() * 2;
        sizeJitter.current[spawnedIndex] = 0.85 + Math.random() * 0.3;
      }

      for (let i = 0; i < count; i++) {
        const lifetime = state.lifetimes[i];
        const puffIdx = i * 3;

        if (lifetime <= 0) {
          for (let v = 0; v < VOXELS_PER_PUFF; v++) {
            voxelAlphas.current[i * VOXELS_PER_PUFF + v] = 0;
          }
          continue;
        }

        const age = 1 - lifetime; // 0 at spawn -> 1 at death

        // Ball inflates ("blown out") then keeps spreading as it fades -
        // the lattice spacing, not individual cube trajectories, is what
        // disperses.
        const blowout = smoothstep(0, 0.3, age);
        const drift = age > 0.3 ? (age - 0.3) / 0.7 : 0;
        const spacing =
          CLUSTER_SPACING * (1 + blowout * 0.8 + drift * (MAX_SPREAD - 1.8));

        const cubeScale =
          VOXEL_SIZE *
          sizeJitter.current[i] *
          (1 - smoothstep(0.3, 1, age) * 0.7);
        tmpScale.current.set(cubeScale, cubeScale, cubeScale);

        // The whole puff tumbles as one rigid body: its fixed spawn
        // orientation plus a continuous spin about its own axis.
        const oi = i * 4;
        tmpOrientation.current.set(
          orientations.current[oi],
          orientations.current[oi + 1],
          orientations.current[oi + 2],
          orientations.current[oi + 3],
        );
        const ai = i * 3;
        tmpAxis.current.set(
          spinAxes.current[ai],
          spinAxes.current[ai + 1],
          spinAxes.current[ai + 2],
        );
        tmpSpin.current.setFromAxisAngle(
          tmpAxis.current,
          age * spinRates.current[i],
        );
        tmpOrientation.current.premultiply(tmpSpin.current);

        const fadeIn = smoothstep(0, 0.05, age);
        const fadeOut = 1 - smoothstep(0.5, 1, age);
        const alpha = fadeIn * fadeOut;

        for (let v = 0; v < VOXELS_PER_PUFF; v++) {
          const gi = i * VOXELS_PER_PUFF + v;
          const [ox, oy, oz] = LATTICE_OFFSETS[v];

          tmpOffset.current
            .set(ox, oy, oz)
            .multiplyScalar(spacing)
            .applyQuaternion(tmpOrientation.current);

          tmpPosition.current.set(
            state.positions[puffIdx] + tmpOffset.current.x,
            state.positions[puffIdx + 1] + tmpOffset.current.y,
            state.positions[puffIdx + 2] + tmpOffset.current.z,
          );

          tmpMatrix.current.compose(
            tmpPosition.current,
            tmpOrientation.current,
            tmpScale.current,
          );
          mesh.setMatrixAt(gi, tmpMatrix.current);

          voxelAlphas.current[gi] = alpha;
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
