import { Vector3 } from "three";
import planetParams from "./planetParams.json";

export interface Planet {
  id: string;
  center: Vector3;
  radius: number;
  shipAltitude: number;
}

// Only one planet exists today, so the ship is always snapped to it - but
// keeping a small registry (rather than hardcoding its radius everywhere)
// means a future second planet just needs an entry here plus a way to pick
// it, without the surface-travel math itself having to change.
export const PLANETS: Planet[] = [
  {
    id: "home",
    center: new Vector3(0, 0, 0),
    radius: planetParams.radius,
    shipAltitude: planetParams.shipAltitude,
  },
];

/** The planet the ship is currently snapped to - always the first (only) one for now. */
export const getActivePlanet = (): Planet => PLANETS[0];

/** Radius of the shell the ship cruises on above a planet's surface. */
export const getShellRadius = (planet: Planet = getActivePlanet()): number =>
  planet.radius + planet.shipAltitude;
