import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import Galaxy from "../galaxy";
import Ship from "../ship";
import Camera from "../camera";
import Overlay from "../helper/overlay";
import Lights from "../lights";
const Scene = () => {
  const config = {
    showCameraHelper: true,
    showStats: false,
  };

  return (
    <>
      <Canvas id="threejs-canvas">
        {/* Lighting */}
        <Camera helper={config.showCameraHelper} />
        <Lights />

        {/* Scene Elements */}
        <Galaxy />
        <Ship />
        {/* Stats */}
        {config.showStats && <Stats />}
      </Canvas>
      {/* Camera Helper */}
      {config.showCameraHelper && <Overlay />}
    </>
  );
};

export default Scene;
