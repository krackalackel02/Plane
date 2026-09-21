import React, { useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three"; // Import THREE for Vector3
import { useEnvironment } from "../../context/envContext";

interface SphereProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  label?: string;
}

// --- Define constants for the arrows ---
const arrowOrigin = new THREE.Vector3(0, 0, 0);
const arrowLength = 1.5; // Make arrows visible outside the 0.5 radius sphere
const arrowHeadLength = 0.3;
const arrowHeadWidth = 0.15;

// Define direction vectors
const dirX = new THREE.Vector3(1, 0, 0);
const dirY = new THREE.Vector3(0, 1, 0);
const dirZ = new THREE.Vector3(0, 0, 1);
// ----------------------------------------

const Sphere: React.FC<SphereProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color = "#CCFF00", // A more neon-like yellow-green
  label,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { showSpheres } = useEnvironment();
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);
  // Update material properties imperatively when hover state changes
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.emissive.set(isHovered ? color : "#000000");
      materialRef.current.emissiveIntensity = isHovered ? 1 : 0;
      materialRef.current.toneMapped = false;
      materialRef.current.needsUpdate = true;
    }
  }, [isHovered, color]);
  return (
    showSpheres && (
      <mesh
        position={position}
        rotation={rotation}
        onPointerOver={(event) => {
          event.stopPropagation(); // Stop event from bubbling to parent objects
          setIsHovered(true);
        }}
        onPointerOut={() => setIsHovered(false)}
      >
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial ref={materialRef} color={color} />

        {/* X-axis Arrow (Red) */}
        <arrowHelper
          args={[
            dirX,
            arrowOrigin,
            arrowLength,
            0xff0000, // Red color
            arrowHeadLength,
            arrowHeadWidth,
          ]}
        />

        {/* Y-axis Arrow (Green) */}
        <arrowHelper
          args={[
            dirY,
            arrowOrigin,
            arrowLength,
            0x00ff00, // Green color
            arrowHeadLength,
            arrowHeadWidth,
          ]}
        />

        {/* Z-axis arrowHelper (Blue) */}
        <arrowHelper
          args={[
            dirZ,
            arrowOrigin,
            arrowLength,
            0x0000ff, // Blue color
            arrowHeadLength,
            arrowHeadWidth,
          ]}
        />

        {/* Conditionally render the HTML label on hover */}
        {isHovered && label && (
          <Html distanceFactor={10}>
            <div
              style={{
                padding: "4px 8px",
                background: "rgba(0, 0, 0, 0.75)",
                color: "white",
                borderRadius: "6px",
                fontSize: "14px",
                whiteSpace: "nowrap",
                transform: "translate(-50%, -150%)", // Position label above the sphere
              }}
            >
              {label}
            </div>
          </Html>
        )}
      </mesh>
    )
  );
};

export default Sphere;
