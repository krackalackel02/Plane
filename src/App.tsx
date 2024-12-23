import "./App.css";
import Counter from "./components/counter";
import { Canvas } from "@react-three/fiber";
import Box from "./components/box";
import { Stats, OrbitControls } from "@react-three/drei";
import Galaxy from "./components/galaxy";

function App() {
  return (
    <>
      <Canvas id="threejs-canvas" camera={{ position: [0, 0, 50], fov: 75 }}>
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
        <Box position={[-1.2, 0, 0]} />
        <Box position={[1.2, 0, 0]} />
        <Galaxy />

        {/* Controls and Stats */}
        <OrbitControls />
        <Stats />
      </Canvas>
      <Counter />
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
