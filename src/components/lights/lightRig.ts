type Vec3 = [number, number, number];

// Where the studio key light comes from (the top-left, matching the
// claymation landmasses' own bevel highlight - see landmass.tsx), and the
// soft fill from the opposite side. Directions only: both lights stand far
// outside the planet along them.
const KEY_DIRECTION: Vec3 = [-14, 18, 10];
const FILL_DIRECTION: Vec3 = [10, -6, -10];
// Well clear of the planet (radius 40), its tallest peaks and its clouds.
const LIGHT_DISTANCE = 120;

const placeAt = (direction: Vec3): Vec3 => {
  const length = Math.hypot(...direction);
  return direction.map((d) => (d / length) * LIGHT_DISTANCE) as Vec3;
};

/**
 * The shadow-casting key light, and its shadow camera's reach.
 *
 * It has to stand outside the planet: three.js puts a directional light's
 * shadow camera at the light's own position, looking at its target. When
 * this light sat 25 units from the centre - inside a planet of radius 40 -
 * the whole hemisphere facing it lay *behind* its shadow camera, so nothing
 * there ever cast or received a shadow. From out here the camera's depth
 * range spans the entire planet, peaks and clouds included, and its frustum
 * is sized to the planet itself rather than the moon's much wider orbit,
 * which would dilute resolution for shadows that rarely land on anything.
 */
export const KEY_LIGHT = {
  position: placeAt(KEY_DIRECTION),
  /** Half-width of the shadow camera's square frustum. */
  shadowExtent: 58,
  shadowNear: LIGHT_DISTANCE - 60,
  shadowFar: LIGHT_DISTANCE + 60,
};

/** The soft fill, from the opposite side. */
export const FILL_LIGHT_POSITION = placeAt(FILL_DIRECTION);
