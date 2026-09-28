/**
 * Lights component for 3D scene
 * @returns JSX.Element
 */
const Lights = () => {
  return (
    <>
      {/* Soft sky/ground fill - approximates the gentle ambient occlusion
          a real studio setup would pick up, without a full AO pass. */}
      <hemisphereLight args={["#dce8ff", "#2a2a35", 0.55]} />
      {/* Key light, top-left, matching the claymation planet's own baked-in
          highlight direction (see planetTexture.ts). */}
      <directionalLight position={[-14, 18, 10]} intensity={1.1} />
      {/* Soft fill from the opposite side, low intensity, so shadowed
          faces don't go fully flat/black. */}
      <pointLight position={[10, -6, -10]} intensity={0.5} />
    </>
  );
};

export default Lights;
