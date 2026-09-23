/// 3js/fiber for rendering 3D content
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";

/// Context Providers
import { EnvironmentProvider } from "../context/envContext";
import { KeyProvider } from "../context/keyContext";
import { SceneProvider } from "../context/sceneContext";
import { ProjectProvider } from "../context/projectContext";
import { AutopilotProvider } from "../context/autopilotContext";
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
import WelcomeOverlay from "./helper/welcomeOverlay";
import LoadingScreen from "./helper/loadingScreen";

// Tracks when the scene's actual async payload (ship model + board
// textures) has finished loading, so the DOM chrome (minimap, joystick,
// HUD) can be held back and revealed together with the 3D content instead
// of popping in first. Falls back to "ready" after a timeout so a stalled
// or failed asset never leaves the UI permanently hidden.
const useSceneReady = () => {
  const { active, progress } = useProgress();
  const [ready, setReady] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (active) startedRef.current = true;
    if (!active && (startedRef.current || progress === 100)) {
      setReady(true);
    }
  }, [active, progress]);

  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), 8000);
    return () => clearTimeout(timeout);
  }, []);

  return ready;
};

/**
 * 3D Scene component
 * @returns JSX.Element
 */
const Scene = () => {
  const ready = useSceneReady();

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
              <LoadingScreen hidden={ready} />
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
                {/* Intro alert + reopenable controls reference */}
                <WelcomeOverlay />
              </div>
            </AutopilotProvider>
          </ProjectProvider>
        </SceneProvider>
      </KeyProvider>
    </EnvironmentProvider>
  );
};

export default Scene;
