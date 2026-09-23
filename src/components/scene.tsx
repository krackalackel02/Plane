/// 3js/fiber for rendering 3D content
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";

/// Context Providers
import { EnvironmentProvider } from "../context/envContext";
import { KeyProvider } from "../context/keyContext";
import { SceneProvider } from "../context/sceneContext";
import { ProjectProvider } from "../context/projectContext";
import { AutopilotProvider } from "../context/autopilotContext";
import { useLoading } from "../context/loadingContext";
import Stats from "./helper/stats";

/// 3D Scene Components
import Galaxy from "./galaxy";
import Ship from "./ship";
import Camera from "./camera";
import Overlay from "./helper/overlay";
import AutopilotBanner from "./helper/autopilotBanner";
import Lights from "./lights";
import Timeline from "./timeline";
import Sphere from "./helper/sphere";
import MobileControls from "./controls/mobileControls";
import Minimap from "./minimap";
import Highlight from "./timeline/highlight";
import LoadingScreen from "./helper/loadingScreen";

/**
 * 3D Scene component
 * @returns JSX.Element
 */
const Scene = () => {
  // Loading state comes from LoadingProvider (wrapping the app in App.tsx),
  // the same source Camera uses to gate its intro flythrough - so the
  // splash, the DOM chrome fade-in below, and the camera animation all stay
  // in sync off one signal instead of three independent ones.
  const { ready } = useLoading();

  return (
    <EnvironmentProvider>
      {/* Provide environment configuration to the scene */}
      <KeyProvider>
        {/* Provide keyboard input context */}
        <SceneProvider>
          {/* Provide scene object reference context */}
          <ProjectProvider>
            {/* Provide loaded projects context */}
            <AutopilotProvider>
              {/* Provide autopilot flight-request context */}
              <Canvas id="threejs-canvas">
                {/** 3D rendering canvas */}
                {/*
                  Camera Setup
                  - Ship-following camera component
                */}
                {/* Camera */}
                <Camera />
                {/*
                  Lighting Setup
                  - Scene lights configuration
                */}
                <Lights />
                {/*
                  Objects Setup
                  - Scene objects configuration
                  Galaxy has nothing to load, so it's kept outside the
                  suspending subtrees below and paints on the very first
                  frame instead of waiting on the ship model/board textures.
                */}
                <Galaxy />
                {/* Background galaxy component */}
                {/* Ship and Timeline each get their own Suspense boundary
                    so a slow board texture doesn't hold back the ship (or
                    vice versa) - the scene fills in progressively. */}
                <Suspense fallback={null}>
                  <Ship />
                  {/* Main ship component */}
                </Suspense>
                <Sphere position={[0, 0, 0]} label="Origin" />
                {/* Origin sphere */}
                <Suspense fallback={null}>
                  <Timeline /> {/* CV Timeline Objects Path Component */}
                </Suspense>
                {/* Performance Stats */}
                <Stats />
              </Canvas>
              <LoadingScreen />
              {/* DOM chrome held back until the 3D scene is ready, then
                  faded in together instead of appearing before it. */}
              <div
                className={`scene-chrome${ready ? " scene-chrome--visible" : ""}`}
              >
                {/* Camera Helper */}
                <Overlay /> {/* Overlay for camera helper and HUD */}
                <AutopilotBanner />
                {/* Bottom-left GTA5-style minimap */}
                <Minimap />
                {/* Touch controls */}
                <MobileControls />
                {/* Project details modal, shown when the ship activates a board */}
                <Highlight />
              </div>
            </AutopilotProvider>
          </ProjectProvider>
        </SceneProvider>
      </KeyProvider>
    </EnvironmentProvider>
  );
};

export default Scene;
