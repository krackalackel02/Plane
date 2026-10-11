import React, { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, PointsMaterial } from "three";
import { getActivePlanet, getShellRadius } from "../../utils/planets";

// Vertical spread for stars - kept independent of the planet's radius since
// the sky is purely decorative backdrop and should fill out the space
// above/below the ship's cruise shell too.
const STAR_Y_RANGE = 150;
// Stars spawn across a disk this many times wider than the planet's own
// shell - a starfield capped at the planet's own radius would look far too
// close and go visibly empty near it.
const STAR_FIELD_RADIUS_MULTIPLIER = 4;
// Matches the old 0.1-radius spheres' apparent size: three sizes an
// attenuated point as size * (half the canvas height) / depth, leaving out
// the 1 / tan(fov / 2) a real object's perspective adds - so the 0.2
// diameter is divided by tan(25deg), the main camera's default 50deg field
// of view.
const STAR_SIZE = 0.2 / Math.tan((25 * Math.PI) / 180);

/**
 * Every star is one vertex, drawn by the GPU as a point sprite: sized by its
 * distance in the vertex shader (sizeAttenuation) and rounded off in the
 * fragment shader. The field used to be 4,000 instanced spheres - 112
 * triangles apiece, ~450k triangles a frame for dots a pixel or two across -
 * whose matrices drei re-copied into the instance buffer every frame. Now
 * it's one static buffer and one draw call.
 */
const starMaterial = new PointsMaterial({
  color: "white",
  size: STAR_SIZE,
  sizeAttenuation: true,
});
// Round, not square: discard the corners of each point sprite.
starMaterial.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <clipping_planes_fragment>",
    "if (length(gl_PointCoord - 0.5) > 0.5) discard;\n#include <clipping_planes_fragment>",
  );
};

/**
 * Stars component to render a field of stars in the galaxy. Spans a disk
 * much larger than the planet's shell (see utils/planets) so the sky still
 * reads as full no matter where on the planet the ship is flying.
 * @param count - Number of stars to render
 * @returns JSX.Element
 */
const Stars: React.FC<{ count?: number }> = ({ count = 1000 }) => {
  const planet = getActivePlanet();
  const fieldRadius = getShellRadius(planet) * STAR_FIELD_RADIUS_MULTIPLIER;

  // Positions uniformly within the star field's disk (sqrt of a uniform
  // random radius fraction gives uniform area density - a plain linear
  // radius would bunch stars up near the center instead).
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = fieldRadius * Math.sqrt(Math.random());
      positions[i * 3] = planet.center.x + radius * Math.cos(angle);
      positions[i * 3 + 1] =
        planet.center.y + (Math.random() - 0.5) * STAR_Y_RANGE;
      positions[i * 3 + 2] = planet.center.z + radius * Math.sin(angle);
    }
    const stars = new BufferGeometry();
    stars.setAttribute("position", new BufferAttribute(positions, 3));
    return stars;
  }, [count, planet, fieldRadius]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return <points geometry={geometry} material={starMaterial} />;
};

export default Stars;
