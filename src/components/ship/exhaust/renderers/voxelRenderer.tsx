import React, { useMemo, useRef } from "react";
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

import { smoothstep } from "../../../../utils/3d";
import { useExhaustSimulation } from "../useExhaustSimulation";
import {
  matteColorMap,
  applyBoostTint,
  BOOST_SIZE_MULTIPLIER,
  BOOST_TINT,
} from "../colorMaps";
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

const VOXEL_SIZE = 0.2;
const CLUSTER_SPACING = 0.15; // > voxel size would leave gaps at spawn; this overlaps them into a solid-looking ball
const MAX_SPREAD = 2.6; // how many times wider the lattice gets by end of life - kept modest so the two jets' plumes stay visually separate

const SPARK_COLOR: [number, number, number] = [1, 0.92, 0.7];

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
 * dissolving, not individual embers flying off. A handful of bright,
 * flickering sparks (additive-blended points) ride along the freshest part
 * of each puff for a hot-exhaust glint.
 */
const VoxelRenderer: React.FC<ExhaustRendererProps> = ({
  active,
  position,
  count = 30,
  coneAngle = Math.PI / 6,
  decaySpeed = 0.01,
  speedDecay = 0.98,
  reverse = false,
  boost = false,
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const totalVoxels = count * VOXELS_PER_PUFF;

  // Per-puff rigid-body state, (re)assigned whenever that puff spawns.
  const orientations = useRef(new Float32Array(count * 4)); // quaternion xyzw
  const spinAxes = useRef(new Float32Array(count * 3));
  const spinRates = useRef(new Float32Array(count));
  const sizeJitter = useRef(new Float32Array(count).fill(1));
  const sparkPhase = useRef(new Float32Array(count));
  const sparkRate = useRef(new Float32Array(count));

  const voxelAlphas = useRef(new Float32Array(totalVoxels));
  const voxelColors = useRef(new Float32Array(totalVoxels * 3));
  // Stable across re-renders (only recreated if `totalVoxels` changes) -
  // see particleRenderer.tsx for why an inline `new Float32Array(...)`
  // passed directly in JSX would replace these instanced buffers with a
  // zeroed array (and flash every voxel) on every boost/reverse toggle.
  const voxelAlphaArray = useMemo(
    () => new Float32Array(totalVoxels),
    [totalVoxels],
  );
  const voxelColorArray = useMemo(
    () => new Float32Array(totalVoxels * 3),
    [totalVoxels],
  );
  // Per-puff selected voxel indices to act as sparks (small number)
  const sparkIndices = useRef(new Int8Array(count * 2));

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
        sparkPhase.current[spawnedIndex] = Math.random() * Math.PI * 2;
        sparkRate.current[spawnedIndex] = 18 + Math.random() * 14;
        // Choose two voxel indices for occasional bright spark cubes.
        sparkIndices.current[spawnedIndex * 2] = Math.floor(
          Math.random() * VOXELS_PER_PUFF,
        );
        sparkIndices.current[spawnedIndex * 2 + 1] = Math.floor(
          Math.random() * VOXELS_PER_PUFF,
        );
      }

      const boostScale = boost ? BOOST_SIZE_MULTIPLIER : 1;
      const sparkBoost = boost ? BOOST_SIZE_MULTIPLIER : 1;

      for (let i = 0; i < count; i++) {
        const lifetime = state.lifetimes[i];
        const puffIdx = i * 3;

        if (lifetime <= 0) {
          // Ensure dead puffs don't leave visible instances behind. Move
          // each cube far off-screen and shrink it to zero so the GPU
          // cannot produce large screen-space squares from stale matrices.
          tmpScale.current.set(0, 0, 0);
          tmpPosition.current.set(1e6, 1e6, 1e6);
          tmpMatrix.current.compose(
            tmpPosition.current,
            tmpOrientation.current,
            tmpScale.current,
          );
          for (let v = 0; v < VOXELS_PER_PUFF; v++) {
            const gi = i * VOXELS_PER_PUFF + v;
            mesh.setMatrixAt(gi, tmpMatrix.current);
            voxelAlphas.current[gi] = 0;
            voxelColors.current.set([0, 0, 0], gi * 3);
          }
          // removed legacy spark buffer updates (sparks are now voxels)
          continue;
        }

        const age = 1 - lifetime; // 0 at spawn -> 1 at death

        // Ball inflates ("blown out") then keeps spreading as it fades -
        // the lattice spacing, not individual cube trajectories, is what
        // disperses. Kept modest (MAX_SPREAD) so two jets firing side by
        // side stay visually distinct instead of merging into one blob.
        const blowout = smoothstep(0, 0.3, age);
        const drift = age > 0.3 ? (age - 0.3) / 0.7 : 0;
        const spacing =
          CLUSTER_SPACING *
          boostScale *
          (1 + blowout * 0.5 + drift * (MAX_SPREAD - 1.5));

        const cubeScale =
          VOXEL_SIZE *
          boostScale *
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

        // Prepare per-puff spark parameters once to avoid repeated work
        const si0 = sparkIndices.current[i * 2];
        const si1 = sparkIndices.current[i * 2 + 1];
        const heat =
          smoothstep(0, 0.05, age) * (1 - smoothstep(0.15, 0.4, age));
        const flicker = Math.max(
          0,
          Math.sin(age * sparkRate.current[i] + sparkPhase.current[i]),
        );
        const baseSparkBrightness = heat * flicker * sparkBoost * 1.2;

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

          // Decide if this voxel should act as a bright spark for this
          // frame. Sparks are rarer and smaller than regular voxels.
          let isSpark = false;
          if ((v === si0 || v === si1) && heat > 0.02) {
            if (baseSparkBrightness > 0.08 && Math.random() < 0.35) {
              isSpark = true;
            }
          }

          const scaleFactor = isSpark ? 0.5 : 1; // sparks are half-size
          tmpScale.current.set(
            cubeScale * scaleFactor,
            cubeScale * scaleFactor,
            cubeScale * scaleFactor,
          );

          tmpMatrix.current.compose(
            tmpPosition.current,
            tmpOrientation.current,
            tmpScale.current,
          );
          mesh.setMatrixAt(gi, tmpMatrix.current);

          // Default visual for voxel comes from the shared sim color and alpha
          voxelAlphas.current[gi] = alpha;
          if (boost) {
            const [r, g, b] = applyBoostTint(
              state.colors[puffIdx],
              state.colors[puffIdx + 1],
              state.colors[puffIdx + 2],
            );
            voxelColors.current.set([r, g, b], gi * 3);
          } else {
            voxelColors.current.set(
              [
                state.colors[puffIdx],
                state.colors[puffIdx + 1],
                state.colors[puffIdx + 2],
              ],
              gi * 3,
            );
          }

          if (isSpark) {
            // Brighten spark voxel color and alpha; bias sparks toward
            // hot-blue when boosting so they read like hotter embers.
            const sparkTint = boost
              ? [
                  (SPARK_COLOR[0] + BOOST_TINT[0]) / 2,
                  (SPARK_COLOR[1] + BOOST_TINT[1]) / 2,
                  (SPARK_COLOR[2] + BOOST_TINT[2]) / 2,
                ]
              : SPARK_COLOR;
            voxelColors.current.set(
              [
                sparkTint[0] * (1 + baseSparkBrightness),
                sparkTint[1] * (1 + baseSparkBrightness),
                sparkTint[2] * (1 + baseSparkBrightness),
              ],
              gi * 3,
            );
            voxelAlphas.current[gi] = Math.min(1, alpha + baseSparkBrightness);
          }
        }

        // (No separate spark point sprites anymore - sparks are implemented
        // as occasional bright voxels inside the lattice.)
      }

      mesh.instanceMatrix.needsUpdate = true;
      const { attributes } = mesh.geometry;
      (attributes.voxelAlpha.array as Float32Array).set(voxelAlphas.current);
      (attributes.voxelColor.array as Float32Array).set(voxelColors.current);
      attributes.voxelAlpha.needsUpdate = true;
      attributes.voxelColor.needsUpdate = true;

      // no separate spark attributes to update
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
            array={voxelAlphaArray}
            count={totalVoxels}
            itemSize={1}
          />
          <instancedBufferAttribute
            attach="attributes-voxelColor"
            array={voxelColorArray}
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
