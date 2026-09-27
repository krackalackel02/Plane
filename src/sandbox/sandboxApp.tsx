import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { EnvironmentProvider } from "../context/envContext";
import { KeyProvider } from "../context/keyContext";
import { SceneProvider } from "../context/sceneContext";
import { ProjectProvider } from "../context/projectContext";
import { AutopilotProvider } from "../context/autopilotContext";
import { TrickProvider } from "../context/trickContext";
import { ExhaustModeProvider } from "../context/exhaustModeContext";
import { SANDBOX_REGISTRY, getSandboxEntry } from "./registry";
import SandboxScene from "./sandboxScene";
import "./sandbox.css";

// Plain <a href="?component=..."> links (a full navigation, not client
// routing) - this is meant to be driven by a pasted/typed URL just as
// much as by clicking, so a real page load keeping the query string is
// simpler and more robust than syncing router state.
const ComponentPicker = ({ unknownKey }: { unknownKey?: string }) => (
  <div className="sandbox-picker">
    <h1>Component Sandbox</h1>
    {unknownKey && (
      <p className="sandbox-error">
        No sandbox component registered for &quot;{unknownKey}&quot;.
      </p>
    )}
    <p>Pick a component to inspect, rotate, zoom and tune in isolation.</p>
    <ul>
      {SANDBOX_REGISTRY.map((entry) => (
        <li key={entry.key}>
          <a href={`?component=${entry.key}`}>{entry.label}</a>
          <span className="sandbox-picker-description">
            {entry.description}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

const SandboxApp = () => {
  const requested = new URLSearchParams(window.location.search).get(
    "component",
  );
  const entry = getSandboxEntry(requested);

  if (!entry) {
    return <ComponentPicker unknownKey={requested ?? undefined} />;
  }

  return (
    // Only the lightweight, DOM/state-only providers the isolated
    // components actually read from (see each ./components/*Sandbox.tsx
    // for which) - no physics, audio, loading-screen or boundary
    // providers, since those drive full-scene gameplay concerns this
    // sandbox intentionally leaves out.
    <EnvironmentProvider>
      <KeyProvider>
        <SceneProvider>
          <ProjectProvider>
            <AutopilotProvider>
              <TrickProvider>
                <ExhaustModeProvider>
                  <div className="sandbox-hud">
                    <a className="sandbox-back" href="?">
                      &larr; All components
                    </a>
                    <span className="sandbox-title">{entry.label}</span>
                  </div>
                  <Canvas
                    id="sandbox-canvas"
                    camera={{ position: [4, 3, 6], fov: 50 }}
                  >
                    <Suspense fallback={null}>
                      <SandboxScene entry={entry} />
                    </Suspense>
                  </Canvas>
                </ExhaustModeProvider>
              </TrickProvider>
            </AutopilotProvider>
          </ProjectProvider>
        </SceneProvider>
      </KeyProvider>
    </EnvironmentProvider>
  );
};

export default SandboxApp;
