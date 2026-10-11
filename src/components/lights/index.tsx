import { FILL_LIGHT_POSITION, KEY_LIGHT } from "./lightRig";

/**
 * Lights component for 3D scene
 * @returns JSX.Element
 */
const Lights = () => {
  return (
    <>
      {/* Soft ambient fill - keeps shadowed faces readable without
          flattening the key light's contrast. */}
      <ambientLight intensity={0.5} />
      {/* Strong studio key light - the only shadow-casting light (a single
          caster keeps the shadow pass cheap). Stands outside the planet so
          its shadow camera can see all of it - see lightRig.ts. */}
      <directionalLight
        position={KEY_LIGHT.position}
        intensity={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-KEY_LIGHT.shadowExtent}
        shadow-camera-right={KEY_LIGHT.shadowExtent}
        shadow-camera-top={KEY_LIGHT.shadowExtent}
        shadow-camera-bottom={-KEY_LIGHT.shadowExtent}
        shadow-camera-near={KEY_LIGHT.shadowNear}
        shadow-camera-far={KEY_LIGHT.shadowFar}
        // A curved surface lit at grazing angles self-shadows in stripes
        // ("acne") without a little normal-direction offset.
        shadow-normalBias={0.04}
      />
      {/* Soft fill from the opposite side, so faces turned away from the key
          light don't go flat black. Directional, not a point light: a point
          light this far out (or, as it once was, inside the planet, where it
          faced the back of every surface) falls off to nothing. */}
      <directionalLight position={FILL_LIGHT_POSITION} intensity={0.35} />
    </>
  );
};

export default Lights;
