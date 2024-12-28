const Lights = () => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.3}
        penumbra={1}
        decay={0}
        intensity={1}
      />
      <pointLight position={[-10, -10, -10]} intensity={1} />
    </>
  );
};

export default Lights;
