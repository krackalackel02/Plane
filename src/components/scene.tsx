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
import { useRef } from "react";
import { Group } from "three";

const Scene = () => {
  const shipRef = useRef<Group>(null);

  return (
    <EnvironmentProvider>
      <KeyProvider>
        <Canvas id="threejs-canvas">
          {/* Camera */}
          <Camera shipRef={shipRef} />

          {/* Lighting */}
          <Lights />

          {/* Scene Elements */}
          <Galaxy />
          <Ship shipRef={shipRef} />
          <Timeline />

          {/* Stats */}
          <Stats />
        </Canvas>

        {/* Camera Helper */}
        <Overlay />
      </KeyProvider>
    </EnvironmentProvider>
  );
};

export default Scene;
