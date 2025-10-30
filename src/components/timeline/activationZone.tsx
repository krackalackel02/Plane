import React, { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Mesh, MeshStandardMaterial, Shape, DoubleSide } from "three";
import { useScene } from "../../context/sceneContext";

interface ActivationZoneProps {
  position: [number, number, number];
  size?: [number, number]; // width, length
  borderThickness?: number; // Thickness of the border lines
  depth?: number; // The height/extrusion of the border
}

const ActivationZone: React.FC<ActivationZoneProps> = ({
  position,
  size = [8, 6],
  borderThickness = 0.2,
  depth = 0.1,
}) => {
  const meshRef = useRef<Mesh>(null);
  const { shipRef } = useScene();
  const [isHovered, setIsHovered] = useState(false);

  const defaultColor = new Color("#888888");
  const hoverColor = new Color("#ffffff");

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

  useFrame(() => {
    if (!meshRef.current || !shipRef?.current) return;

    const shipPosition = shipRef.current.position;
    const zonePosition = meshRef.current.position;

    // Bounding box check remains the same
    const minX = zonePosition.x - size[0] / 2;
    const maxX = zonePosition.x + size[0] / 2;
    const minZ = zonePosition.z - size[1] / 2;
    const maxZ = zonePosition.z + size[1] / 2;

    const currentlyHovered =
      shipPosition.x >= minX &&
      shipPosition.x <= maxX &&
      shipPosition.z >= minZ &&
      shipPosition.z <= maxZ;

    if (currentlyHovered !== isHovered) {
      setIsHovered(currentlyHovered);
    }

    const material = meshRef.current.material as MeshStandardMaterial;
    material.color.lerp(currentlyHovered ? hoverColor : defaultColor, 0.1);
    material.opacity = currentlyHovered ? 0.5 : 0.25;
  });

  return (
    <mesh ref={meshRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <extrudeGeometry
        args={[frameGeometry.shape, frameGeometry.extrudeSettings]}
      />
      <meshStandardMaterial
        color={defaultColor}
        opacity={0.25}
        side={DoubleSide} // Make it visible from both sides
      />
    </mesh>
  );
};

export default ActivationZone;
