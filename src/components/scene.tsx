import { Canvas } from "@react-three/fiber";
import Galaxy from "./galaxy";
import Ship from "./ship";
import Camera from "./camera";
import Overlay from "./helper/overlay";
import Lights from "./lights";
import Timeline from "./timeline";
import { EnvironmentProvider } from "../context/envContext";
import { KeyProvider } from "../context/keyContext";
import Stats from "./helper/stats";
import { SceneProvider } from "../context/sceneContext";

const Scene = () => {
  return (
    <EnvironmentProvider>
      <KeyProvider>
        <SceneProvider>
          <Canvas id="threejs-canvas">
            {/* Camera */}
            <Camera />

            {/* Lighting */}
            <Lights />

            {/* Scene Elements */}
            <Galaxy />
            <Ship />
            <Timeline />

            {/* Stats */}
            <Stats />
          </Canvas>

          {/* Camera Helper */}
          <Overlay />
        </SceneProvider>
      </KeyProvider>
    </EnvironmentProvider>
  );
};

export default Scene;
