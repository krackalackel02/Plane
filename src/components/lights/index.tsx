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
          landmasses' own bevel highlight direction (see landmass.tsx). */}
      <directionalLight position={[-14, 18, 10]} intensity={2} />
      {/* Soft fill from the opposite side, low intensity, so shadowed
          faces don't go fully flat/black. */}
      <pointLight position={[10, -6, -10]} intensity={0.35} />
    </>
  );
};

export default Lights;
