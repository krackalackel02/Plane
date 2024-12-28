import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import Galaxy from "../galaxy";
import Ship from "../ship";
import Camera from "../helper/camera";
const Scene = () => {
  const config = {
    showCameraHelper: false,
    showStats: false,
  };

  return (
    <>
      <Canvas id="threejs-canvas">
        {/* Lighting */}
        <Camera helper={config.showCameraHelper} />
        <ambientLight intensity={0.5} />
        <spotLight
          position={[10, 10, 10]}
          angle={0.3}
          penumbra={1}
          decay={0}
          intensity={1}
        />
        <pointLight position={[-10, -10, -10]} intensity={1} />

        {/* Scene Elements */}
        <Galaxy />
        <Ship />
        {/* Stats */}
        {config.showStats && <Stats />}
      </Canvas>
      {/* Camera Helper */}
      {config.showCameraHelper && (
        <div id="camera-vectors">
          <span>Free Camera Vectors:</span>
          <br />
          <span id="position"></span>
          <br />
          <span id="lookingAt"></span>
        </div>
      )}
    </>
  );
};

export default Scene;
