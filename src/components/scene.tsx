import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import Galaxy from "./galaxy";
import Ship from "./ship";
import Camera from "./camera";
import Overlay from "./helper/overlay";
import Lights from "./lights";
import Timeline from "./timeline";
import { EnvironmentProvider, useEnvironment } from "../context/environment";
import { KeyProvider } from "../context/keys";
const Scene = () => {
  const { showCameraHelper, showShip, showStats } = useEnvironment();
  // console.log(showCameraHelper, showShip, showStats);
  return (
    <EnvironmentProvider>
      <KeyProvider>
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
      </KeyProvider>
    </EnvironmentProvider>
  );
};

export default Scene;
