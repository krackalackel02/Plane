import { OrbitControls } from "@react-three/drei";
import { useControls } from "leva";
import Lights from "../components/lights";
import { SandboxEntry } from "./registry";

interface SandboxSceneProps {
  entry: SandboxEntry;
}

// Everything here lives inside <Canvas>: the orbit/zoom camera rig, a
// grid + axes for scale reference, and whichever component the registry
// picked. Kept separate from sandboxApp.tsx so the "Scene" leva controls
// sit in their own panel section, apart from the component's own controls.
const SandboxScene = ({ entry }: SandboxSceneProps) => {
  const { showGrid, background } = useControls("Scene", {
    showGrid: true,
    background: "#1a1a1a",
  });

  const { Component } = entry;

  return (
    <>
      <color attach="background" args={[background]} />
      <OrbitControls
        makeDefault
        enableDamping
        minDistance={0.15}
        maxDistance={80}
        target={[0, 0, 0]}
      />
      <Lights />
      {showGrid && <gridHelper args={[20, 20]} />}
      <axesHelper args={[3]} />
      <Component />
    </>
  );
};

export default SandboxScene;
