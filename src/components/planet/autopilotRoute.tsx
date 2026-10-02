import { useMemo } from "react";
import { BoxGeometry, MeshBasicMaterial, TorusGeometry, Vector3 } from "three";
import { useScene } from "../../context/sceneContext";
import { useAutopilot } from "../../context/autopilotContext";
import { getActivePlanet } from "../../utils/planets";
import {
  buildSurfaceOrientation,
  slerpOnSphere,
  surfaceNormal,
} from "../../utils/planetSurface";

// How far above the surface the route floats - just clear of the terrain and
// the cruise ring, so it reads as drawn *on* the world rather than buried in
// it.
const ROUTE_ALTITUDE = 1.2;
const DASH_COUNT = 44;
// Fraction of each dash slot actually drawn; the rest is the gap.
const DASH_DUTY = 0.55;
const DASH_WIDTH = 0.32;
const DASH_THICKNESS = 0.12;

const dashGeometry = new BoxGeometry(DASH_WIDTH, DASH_THICKNESS, 1);
// Rotated flat at construction so its own plane is XZ: the mesh then only
// needs its up aligned to the surface normal, with no extra rotation prop
// (setting both `quaternion` and `rotation-x` on one mesh fights itself).
const markerGeometry = new TorusGeometry(2.2, 0.28, 6, 24).rotateX(Math.PI / 2);
const routeMaterial = new MeshBasicMaterial({
  color: "#ff3b3b",
  toneMapped: false,
});

/**
 * The autopilot's planned route, drawn into the 3D world as a dashed red line
 * ending in a ring at the destination - the same "X marks the spot" marker the
 * minimap draws, so the map and the world agree about where you're going.
 *
 * Only rendered while autopilot is actually flying. The arc is built once per
 * engagement (memoised on the target) rather than per frame: autopilot flies a
 * fixed great-circle slerp from where it engaged to its target, so the route
 * doesn't change mid-flight, and rebuilding a few dozen transforms every frame
 * for a line that never moves would be pure waste.
 */
const AutopilotRoute = () => {
  const { shipRef } = useScene();
  const { target, isFlying } = useAutopilot();
  const planet = getActivePlanet();

  const route = useMemo(() => {
    const ship = shipRef.current;
    if (!target || !ship) return null;

    const radius = planet.radius + ROUTE_ALTITUDE;
    const from = ship.position.clone().sub(planet.center);
    const to = target.position.clone().sub(planet.center);
    const pointAt = (t: number): Vector3 =>
      slerpOnSphere(from, to, t).multiplyScalar(radius).add(planet.center);

    const dashes = Array.from({ length: DASH_COUNT }, (_, i) => {
      const start = i / DASH_COUNT;
      const end = start + DASH_DUTY / DASH_COUNT;
      const a = pointAt(start);
      const b = pointAt(end);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const normal = surfaceNormal(mid, planet.center);
      return {
        position: mid,
        quaternion: buildSurfaceOrientation(normal, b.clone().sub(a)),
        length: a.distanceTo(b),
      };
    });

    const destination = pointAt(1);
    const arrival = pointAt(0.98);
    return {
      dashes,
      destination,
      destinationQuaternion: buildSurfaceOrientation(
        surfaceNormal(destination, planet.center),
        destination.clone().sub(arrival),
      ),
    };
  }, [target, shipRef, planet]);

  if (!isFlying || !route) return null;

  return (
    <group>
      {route.dashes.map((dash, i) => (
        <mesh
          key={i}
          geometry={dashGeometry}
          material={routeMaterial}
          position={dash.position}
          quaternion={dash.quaternion}
          scale={[1, 1, dash.length]}
        />
      ))}
      <mesh
        geometry={markerGeometry}
        material={routeMaterial}
        position={route.destination}
        quaternion={route.destinationQuaternion}
      />
    </group>
  );
};

export default AutopilotRoute;
