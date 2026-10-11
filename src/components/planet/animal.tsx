import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import { eastNorthAt } from "../../utils/planetSurface";
import { heightAt } from "./planetTerrain";

export type AnimalVariant = "sheep" | "cow" | "penguin";

// Shared across every animal instance, like the trees above.
const legGeometry = new BoxGeometry(0.12, 0.35, 0.12);
const sheepBodyGeometry = new IcosahedronGeometry(0.42, 0);
const sheepHeadGeometry = new BoxGeometry(0.22, 0.22, 0.26);
const cowBodyGeometry = new BoxGeometry(0.75, 0.42, 0.42);
const cowHeadGeometry = new BoxGeometry(0.26, 0.26, 0.3);
const cowPatchGeometry = new BoxGeometry(0.3, 0.22, 0.44);

const sheepWoolMaterial = new MeshStandardMaterial({
  color: "#f5f1e8",
  roughness: 0.85,
  flatShading: true,
});
const sheepFaceMaterial = new MeshStandardMaterial({
  color: "#3a3a3a",
  roughness: 0.6,
});
const cowBodyMaterial = new MeshStandardMaterial({
  color: "#f2f2f2",
  roughness: 0.7,
  flatShading: true,
});
const cowPatchMaterial = new MeshStandardMaterial({
  color: "#2b2b2b",
  roughness: 0.7,
  flatShading: true,
});

const penguinBodyGeometry = new IcosahedronGeometry(0.34, 0);
const penguinBellyGeometry = new IcosahedronGeometry(0.24, 0);
const penguinHeadGeometry = new IcosahedronGeometry(0.2, 0);
const penguinBeakGeometry = new BoxGeometry(0.16, 0.06, 0.06);
const penguinWingGeometry = new BoxGeometry(0.07, 0.26, 0.14);
const penguinBackMaterial = new MeshStandardMaterial({
  color: "#23262e",
  roughness: 0.65,
  flatShading: true,
});
const penguinBellyMaterial = new MeshStandardMaterial({
  color: "#f6f8fa",
  roughness: 0.7,
  flatShading: true,
});
const penguinBeakMaterial = new MeshStandardMaterial({
  color: "#e8912d",
  roughness: 0.6,
  flatShading: true,
});

const UP = new Vector3(0, 1, 0);

// Grazing pace, in world units per second - slow enough to read as grazing
// rather than patrolling.
const WALK_SPEED = 0.55;
// Peak turn rate, radians/sec.
const TURN_RATE = 0.9;
// How far ahead to test for the coastline before stepping. Comfortably more
// than one frame's travel, so an animal turns away from the water rather than
// reaching it and getting stuck against the edge.
const LOOKAHEAD = 2.2;
// Leg swing amplitude (radians) and how much stride rate scales with speed.
const LEG_SWING = 0.55;
const STRIDE_RATE = 3.2;

const LEG_OFFSETS: [number, number, number][] = [
  [0.22, 0.18, 0.15],
  [0.22, 0.18, -0.15],
  [-0.22, 0.18, 0.15],
  [-0.22, 0.18, -0.15],
];
// Diagonal gait: front-left moves with back-right, and vice versa - the
// alternation is what reads as walking rather than hopping.
const LEG_PHASE = [0, Math.PI, Math.PI, 0];
// A penguin stands on two feet and waddles, so its pair simply alternates.
const PENGUIN_FOOT_OFFSETS: [number, number, number][] = [
  [0.06, 0.14, 0.13],
  [0.06, 0.14, -0.13],
];

export interface AnimalProps {
  /** Where it starts; from there it wanders under its own steam. */
  position: Vector3;
  /** Initial rotation around the surface normal (facing direction), radians. */
  heading: number;
  variant: AnimalVariant;
  scale?: number;
  /** Deterministic 0..1 draw - separates one animal's wander from the next's. */
  seed: number;
  planetRadius: number;
  planetCenter: Vector3;
}

/**
 * A low-poly grazing animal that wanders its own landmass.
 *
 * It walks rather than standing still: heading is steered by a sum of two
 * slow sine waves at incommensurate rates, which drifts continuously and
 * never closes into the tell-tale circle a single oscillator (or a constant
 * turn rate) would produce. Movement is a real step along the sphere's
 * surface, and before each step it samples heightAt a little way ahead - if
 * that lands in the water it turns hard instead of walking in, so an animal
 * can never wander off its own landmass.
 *
 * Everything is driven in useFrame off refs, so a herd never triggers a React
 * re-render, and the whole thing stays deterministic per `seed`.
 */
const Animal = ({
  position,
  heading,
  variant,
  scale = 1,
  seed,
  planetRadius,
  planetCenter,
}: AnimalProps) => {
  const groupRef = useRef<Group>(null);
  const legRefs = useRef<(Mesh | null)[]>([]);

  // Live wander state, seeded from the scattered spawn point.
  const state = useRef({
    direction: position.clone().sub(planetCenter).normalize(),
    heading,
    height: position.distanceTo(planetCenter) - planetRadius,
  });

  const isSheep = variant === "sheep";
  const isPenguin = variant === "penguin";
  const alignment = useMemo(() => new Quaternion(), []);
  const spin = useMemo(() => new Quaternion(), []);

  useFrame((frameState, delta) => {
    const group = groupRef.current;
    if (!group) return;
    // Guard against the large delta a backgrounded tab produces, which would
    // otherwise teleport the herd across the coastline in a single step.
    const step = Math.min(delta, 0.1);
    const t = frameState.clock.elapsedTime;
    const local = state.current;

    // Two slow, incommensurate oscillators - a wander that keeps changing
    // rather than tracing a circle.
    const steer =
      Math.sin(t * 0.31 + seed * 12.9) * 0.65 +
      Math.sin(t * 0.13 + seed * 27.3) * 0.35;
    local.heading += steer * TURN_RATE * step;

    const { east, north } = eastNorthAt(local.direction);
    const forward = east
      .clone()
      .multiplyScalar(Math.sin(local.heading))
      .addScaledVector(north, Math.cos(local.heading))
      .normalize();

    // Is there still land a short way ahead?
    const lookAngle = LOOKAHEAD / planetRadius;
    const ahead = local.direction
      .clone()
      .multiplyScalar(Math.cos(lookAngle))
      .addScaledVector(forward, Math.sin(lookAngle))
      .normalize();
    const aheadLon = Math.atan2(ahead.x, ahead.z);
    const aheadLat = Math.asin(Math.max(-1, Math.min(1, ahead.y)));
    const aheadHeight = heightAt(
      planetRadius,
      planetCenter,
      aheadLon,
      aheadLat,
    );

    if (aheadHeight <= 0) {
      // Coast ahead - turn away sharply and don't step this frame.
      local.heading += TURN_RATE * 2.5 * step;
    } else {
      const stepAngle = (WALK_SPEED * step) / planetRadius;
      local.direction = local.direction
        .clone()
        .multiplyScalar(Math.cos(stepAngle))
        .addScaledVector(forward, Math.sin(stepAngle))
        .normalize();
      const lon = Math.atan2(local.direction.x, local.direction.z);
      const lat = Math.asin(Math.max(-1, Math.min(1, local.direction.y)));
      // Track the ground under its feet, so it steps up onto a highland
      // instead of walking through the side of one.
      local.height = heightAt(planetRadius, planetCenter, lon, lat);
    }

    group.position
      .copy(local.direction)
      .multiplyScalar(planetRadius + local.height)
      .add(planetCenter);
    alignment.setFromUnitVectors(UP, local.direction);
    spin.setFromAxisAngle(local.direction, local.heading);
    group.quaternion.copy(spin.multiply(alignment));

    // Legs swing only while actually moving.
    const stride = aheadHeight > 0 ? Math.sin(t * STRIDE_RATE) : 0;
    legRefs.current.forEach((leg, i) => {
      if (!leg) return;
      leg.rotation.x =
        stride * LEG_SWING * (Math.cos(LEG_PHASE[i]) >= 0 ? 1 : -1);
    });
  });

  return (
    <group ref={groupRef} scale={scale}>
      {(isPenguin ? PENGUIN_FOOT_OFFSETS : LEG_OFFSETS).map(([x, y, z], i) => (
        <mesh
          key={i}
          ref={(el) => (legRefs.current[i] = el)}
          geometry={legGeometry}
          material={
            isPenguin
              ? penguinBeakMaterial
              : isSheep
                ? sheepFaceMaterial
                : cowPatchMaterial
          }
          position={[x, y, z]}
          castShadow
        />
      ))}
      {isPenguin ? (
        <>
          <mesh
            geometry={penguinBodyGeometry}
            material={penguinBackMaterial}
            position={[0, 0.5, 0]}
            scale={[1, 1.35, 1]}
            castShadow
          />
          <mesh
            geometry={penguinBellyGeometry}
            material={penguinBellyMaterial}
            position={[0.16, 0.48, 0]}
            scale={[0.85, 1.35, 0.95]}
            castShadow
          />
          <mesh
            geometry={penguinHeadGeometry}
            material={penguinBackMaterial}
            position={[0.04, 0.88, 0]}
            castShadow
          />
          <mesh
            geometry={penguinBeakGeometry}
            material={penguinBeakMaterial}
            position={[0.22, 0.86, 0]}
            castShadow
          />
          <mesh
            geometry={penguinWingGeometry}
            material={penguinBackMaterial}
            position={[-0.02, 0.5, 0.3]}
            castShadow
          />
          <mesh
            geometry={penguinWingGeometry}
            material={penguinBackMaterial}
            position={[-0.02, 0.5, -0.3]}
            castShadow
          />
        </>
      ) : isSheep ? (
        <>
          <mesh
            geometry={sheepBodyGeometry}
            material={sheepWoolMaterial}
            position={[0, 0.42, 0]}
            castShadow
          />
          <mesh
            geometry={sheepHeadGeometry}
            material={sheepFaceMaterial}
            position={[0.42, 0.44, 0]}
            castShadow
          />
        </>
      ) : (
        <>
          <mesh
            geometry={cowBodyGeometry}
            material={cowBodyMaterial}
            position={[0, 0.4, 0]}
            castShadow
          />
          <mesh
            geometry={cowPatchGeometry}
            material={cowPatchMaterial}
            position={[-0.15, 0.48, 0]}
            castShadow
          />
          <mesh
            geometry={cowHeadGeometry}
            material={cowBodyMaterial}
            position={[0.55, 0.42, 0]}
            castShadow
          />
        </>
      )}
    </group>
  );
};

export default Animal;
