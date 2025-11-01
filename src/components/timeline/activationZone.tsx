import React, {
  useRef,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  Mesh,
  MeshStandardMaterial,
  Shape,
  DoubleSide,
  Vector3,
  MathUtils,
} from "three";
import { useScene } from "../../context/sceneContext";
import { useProjects } from "../../context/projectContext";
import { log, useFrameDelay } from "../../utils/common";
import Sphere from "../helper/sphere";

interface ActivationZoneProps {
  id: string;
  size?: [number, number];
  borderThickness?: number;
  depth?: number;
  numberOfSquares?: number; // New prop for multiple squares
}

const ActivationZone: React.FC<ActivationZoneProps> = ({
  id,
  size = [8, 6],
  borderThickness = 0.2,
  depth = 0.1,
  numberOfSquares = 2, // Default to 3 squares total
}) => {
  // Refs
  const zoneMeshRef = useRef<Mesh>(null);
  // Use an array of refs for the inner meshes
  const innerMeshRefs = useRef<(Mesh | null)[]>([]);
  const sharedMaterialRef = useRef<MeshStandardMaterial>(null!);

  const { shipRef } = useScene();
  // State and Context
  const { activeProjectId, setActiveProjectId } = useProjects();
  const [isHovered, setIsHovered] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  // Colors, vectors, and scaling
  const defaultColor = useMemo(() => new Color("#888888"), []);
  const hoverColor = useMemo(() => new Color("#ffffff"), []);
  const shipToSquareLocalPosition = new Vector3();
  const innerScale = 0.9;

  // Create a single shared material instance
  const [sharedMaterial] = useState(() => {
    const mat = new MeshStandardMaterial({
      color: defaultColor,
      opacity: 0.25,
      side: DoubleSide,
      transparent: true,
    });
    sharedMaterialRef.current = mat;
    return mat;
  });
  // -------------------------------------------------------------

  // Create the frame geometry using a Shape and ExtrudeGeometry
  const frameGeometry = useMemo(() => {
    const [width, length] = size;
    const shape = new Shape();

    // Define the outer rectangle
    shape.moveTo(-width / 2, -length / 2);
    shape.lineTo(width / 2, -length / 2);
    shape.lineTo(width / 2, length / 2);
    shape.lineTo(-width / 2, length / 2);
    shape.closePath();

    // Define the inner rectangle (the hole)
    const holePath = new Shape();
    const innerWidth = width - borderThickness * 2;
    const innerLength = length - borderThickness * 2;
    holePath.moveTo(-innerWidth / 2, -innerLength / 2);
    holePath.lineTo(innerWidth / 2, -innerLength / 2);
    holePath.lineTo(innerWidth / 2, innerLength / 2);
    holePath.lineTo(-innerWidth / 2, innerLength / 2);
    holePath.closePath();

    // Add the hole to the main shape
    shape.holes.push(holePath);

    // Define extrusion settings for depth
    const extrudeSettings = {
      steps: 1,
      depth: depth,
      bevelEnabled: false,
    };

    return { shape, extrudeSettings };
  }, [size, borderThickness, depth]);

  useEffect(() => {
    setIsActivated(activeProjectId === id && isHovered);
  }, [activeProjectId, id, isHovered]);

  const logDebugInfo = useCallback(() => {
    if (!shipRef.current || !zoneMeshRef.current) return;

    log(`--- DEBUG (ID: ${id}) ---`);
    log("Ship Local Position:", shipRef.current.position);
    log("Ship to Square Position:", shipToSquareLocalPosition);
    log(
      "Ship World Position:",
      shipRef.current.getWorldPosition(new Vector3()),
    );
    log(
      "Zone World Position:",
      zoneMeshRef.current.getWorldPosition(new Vector3()),
    );
  }, [id, shipRef, shipToSquareLocalPosition]);
  // --- Use the custom hook to execute the log function ---
  useFrameDelay(
    logDebugInfo, // The function to execute
    3, // The interval in seconds
    id === "0", // The condition to enable the hook
  );

  useFrame(() => {
    if (!zoneMeshRef.current || !shipRef?.current || !sharedMaterialRef.current)
      return;

    // --- Collision detection (based on the outermost square) ---
    zoneMeshRef.current.worldToLocal(
      shipRef.current.getWorldPosition(shipToSquareLocalPosition),
    );
    const currentlyHovered =
      Math.abs(shipToSquareLocalPosition.x) <= size[1] / 2 &&
      Math.abs(shipToSquareLocalPosition.y) <= size[0] / 2;

    if (currentlyHovered !== isHovered) {
      setIsHovered(currentlyHovered);
      if (currentlyHovered) {
        setActiveProjectId(id);
        log("Entered activation zone for ID:", id);
      } else if (activeProjectId === id) {
        setActiveProjectId(null);
        log("Exited activation zone for ID:", id);
      }
    }

    // --- Animate Shared Material ---
    const material = sharedMaterialRef.current;
    material.color.lerp(isActivated ? hoverColor : defaultColor, 0.1);
    material.opacity = MathUtils.lerp(
      material.opacity,
      isActivated ? 0.5 : 0.25,
      0.1,
    );

    // --- Animate Inner Meshes ---
    innerMeshRefs.current.forEach((mesh, index) => {
      if (mesh) {
        // The targetZ is 0.1 multiplied by the square's index in the stack (1, 2, 3...)
        const targetZ = isActivated ? 0.2 * (index + 1) : 0;
        mesh.position.z = MathUtils.lerp(mesh.position.z, targetZ, 0.1);
      }
    });
  });

  const offsetPosition: [number, number, number] = [-5, -2.5, 0];
  const offsetRotation: [number, number, number] = [-Math.PI / 2, 0, 0];

  return (
    <group position={offsetPosition} rotation={offsetRotation}>
      <Sphere position={[0, 0, 0]} />

      {/* Outermost Mesh (index 0) */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh ref={zoneMeshRef} material={sharedMaterial}>
        <extrudeGeometry
          args={[frameGeometry.shape, frameGeometry.extrudeSettings]}
        />
      </mesh>

      {/* Generate Inner Meshes */}
      {Array.from({ length: numberOfSquares - 1 }).map((_, index) => {
        // The scale is exponential based on the index
        const scale = Math.pow(innerScale, index + 1);
        return (
          <mesh
            key={index}
            ref={(el) => (innerMeshRefs.current[index] = el)}
            // eslint-disable-next-line react/no-unknown-property
            material={sharedMaterial}
            scale={[scale, scale, 1]}
          >
            <extrudeGeometry
              args={[frameGeometry.shape, frameGeometry.extrudeSettings]}
            />
          </mesh>
        );
      })}
    </group>
  );
};

export default ActivationZone;
