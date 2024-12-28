import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import Galaxy from "./galaxy";
import Ship from "./ship";
import Camera from "./camera";
import Overlay from "./helper/overlay";
import Lights from "./lights";
import Timeline from "./timeline";
import { useEnvironment } from "../context/environment";
const Scene = () => {
  const { showCameraHelper, showShip, showStats } = useEnvironment();
  console.log(showCameraHelper, showShip, showStats);
  return (
    <>
      <Canvas id="threejs-canvas">
        {/* Lighting */}
        <Camera helper={showCameraHelper} />
        <Lights />

        {/* Scene Elements */}
        <Galaxy />
        {showShip && <Ship />}
        <Timeline />
        {/* Stats */}
        {showStats && <Stats />}
      </Canvas>
      {/* Camera Helper */}
      {showCameraHelper && <Overlay />}
    </>
  );
};

export default Scene;
