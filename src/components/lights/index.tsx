/**
 * Lights component for 3D scene
 * @returns JSX.Element
 */
const Lights = () => {
  return (
    <>
      <ambientLight intensity={0.5} />{" "}
      {/* Ambient light for general illumination */}
      <spotLight
        position={[10, 10, 10]}
        angle={0.3}
        penumbra={1}
        decay={0}
        intensity={1}
      />{" "}
      {/* Spotlight for focused lighting */}
      <pointLight position={[-10, -10, -10]} intensity={1} />{" "}
      {/* Point light for additional illumination */}
    </>
  );
};

export default Lights;
