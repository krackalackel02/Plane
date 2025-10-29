/// 3js/fiber for rendering 3D content
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import { Group } from "three";

/// Context Providers
import { EnvironmentProvider } from "../context/envContext";
import { KeyProvider } from "../context/keyContext";
import Stats from "./helper/stats";

/// 3D Scene Components
import Galaxy from "./galaxy";
import Ship from "./ship";
import Camera from "./camera";
import Overlay from "./helper/overlay";
import Lights from "./lights";
import Timeline from "./timeline";

/**
 * 3D Scene component
 * @returns JSX.Element
 */
const Scene = () => {
  const shipRef = useRef<Group>(null); // Reference to the ship group

  return (
    <EnvironmentProvider>
      {/* Provide environment configuration to the scene */}
      <KeyProvider>
        {/* Provide keyboard input context */}
        <Canvas id="threejs-canvas">
          {/** 3D rendering canvas */}
          {/* 
            Camera Setup 
             - Ship-following camera component
          */}
          <Camera shipRef={shipRef} />
          {/* 
            Lighting Setup
              - Scene lights configuration
          */}
          <Lights />
          {/* 
            Objects Setup
              - Scene objects configuration
          */}
          <Galaxy /> {/* Background galaxy component */}
          <Ship shipRef={shipRef} /> {/* Main ship component */}
          <Timeline /> {/* CV Timeline Objects Path Component */}
          {/* Performance Stats */}
          <Stats />
        </Canvas>
        {/* Camera Helper */}
        <Overlay /> {/* Overlay for camera helper and HUD */}
      </KeyProvider>
    </EnvironmentProvider>
  );
};

export default Scene;
