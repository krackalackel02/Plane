import "./App.css";
import { Canvas } from "@react-three/fiber";
import { Stats, OrbitControls } from "@react-three/drei";
import Galaxy from "./components/galaxy";
import Ship from "./components/ship";

function App() {
  return (
    <>
      <Canvas id="threejs-canvas">
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <spotLight
          position={[10, 10, 10]}
          angle={0.3}
          penumbra={1}
          decay={0}
          intensity={1}
        />
        <pointLight position={[-10, -10, -10]} intensity={1} />

        {/* Scene Elements */}
        <Galaxy />
        <Ship />
        {/* Controls and Stats */}
        <OrbitControls />
        <Stats />
        {/* <CameraHelper/> */}
      </Canvas>
    </>
  );
}

export default App;
