import "./App.css";
import Counter from "./components/counter";
import { Canvas } from "@react-three/fiber";
import Box from "./components/box";

function App() {
  return (
    <>
      <Canvas id="threejs-canvas">
        {/* Use react-three/fiber's supported props */}
        <ambientLight intensity={Math.PI / 2} />
        <spotLight
          position={[10, 10, 10]} // Correct usage in react-three/fiber
          angle={0.15}
          penumbra={1}
          decay={0}
          intensity={Math.PI}
        />
        <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
        <Box position={[-1.2, 0, 0]} />
        <Box position={[1.2, 0, 0]} />
      </Canvas>
      <Counter />
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
