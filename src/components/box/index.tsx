import * as THREE from "three";
import { useRef, useState } from "react";
import { useFrame, ThreeElements } from "@react-three/fiber";

function Box(props: ThreeElements["mesh"]) {
  const meshRef = useRef<THREE.Mesh | null>(null); // Better type handling for the ref
  const [hovered, setHover] = useState(false);
  const [active, setActive] = useState(false);

  // Rotate the mesh in the useFrame callback, checking for the meshRef
  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta;
    }
  });

  return (
    <mesh
      {...props}
      ref={meshRef}
      scale={active ? 1.5 : 1}
      onClick={() => setActive(!active)} // Simplified click handler
      onPointerOver={() => setHover(true)} // Simplified hover handler
      onPointerOut={() => setHover(false)} // Simplified hover handler
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? "hotpink" : "#2f74c0"} />
    </mesh>
  );
}

export default Box;
