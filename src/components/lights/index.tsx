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
      {/* Strong studio key light, top-left, matching the claymation
          landmasses' own bevel highlight direction (see landmass.tsx) -
          the only shadow-casting light (a single caster keeps the shadow
          pass cheap), sized to the planet's own surface rather than the
          moon's much wider orbit, which would otherwise dilute resolution
          for a shadow that rarely lands on anything anyway. */}
      <directionalLight
        position={[-14, 18, 10]}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-near={1}
        shadow-camera-far={80}
      />
      {/* Soft fill from the opposite side, low intensity, so shadowed
          faces don't go fully flat/black. */}
      <pointLight position={[10, -6, -10]} intensity={0.35} />
    </>
  );
};

export default Lights;
