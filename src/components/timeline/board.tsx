import { useState } from "react";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";
import { Geometry, Base, Subtraction } from "@react-three/csg";

// Leva for UI controls
import { useControls } from "leva";

// Import board parameters from JSON
import boardParams from "../../utils/boardParams.json"; // Import JSON file
import { RoundedBoxGeometry } from "three-stdlib";
import { BoardParams, BoardProps } from "../types/types";
import { createSaveButton } from "../../utils/3d";

/**
 * Default board parameters
 * Used as fallback when no parameters are provided
 * - outerX: Outer dimension in X direction
 * - outerY: Outer dimension in Y direction
 * - outerZ: Outer dimension in Z direction
 * - frame: Frame thickness
 * - depth: Depth of the board
 */
const defaultValues: BoardParams = {
  outerX: 6.7,
  outerY: 4.4,
  outerZ: 0.4,
  frame: 0.35,
  depth: 0.25,
};

// Material component for the board
const Material = () => {
  const baseColorMap = useLoader(
    TextureLoader,
    "./textures/aluminium/base.jpg",
  );
  const metallicMap = useLoader(
    TextureLoader,
    "./textures/aluminium/metal.png",
  );
  const normalMap = useLoader(TextureLoader, "./textures/aluminium/normal.png");
  const roughnessMap = useLoader(
    TextureLoader,
    "./textures/aluminium/rough.png",
  );

  return (
    <meshStandardMaterial
      map={baseColorMap} // Base color
      metalnessMap={metallicMap} // Metallic property
      normalMap={normalMap} // Surface details
      roughnessMap={roughnessMap} // Roughness property
      side={THREE.DoubleSide} // Ensure visibility on both sides
    />
  );
};

/**
 * Board component for displaying a 3D board
 * @param imagePath - Path to the board image texture
 * @param helper - Whether to show helper controls
 * @param position - Position of the board in 3D space
 * @returns JSX.Element
 */
const Board = ({
  imagePath,
  helper = false,
  position = [4.0, 2.5, 0.5],
}: BoardProps) => {
  // Combine default and custom parameters
  const initialValues: BoardParams = { ...defaultValues, ...boardParams };
  const [params, setParams] = useState(initialValues);
  const texture = imagePath ? useLoader(TextureLoader, imagePath) : null;
  const placeHolder = useLoader(TextureLoader, "./images/placeholder.jpg");

  // Function to update a specific parameter
  const updateParam = (key: keyof BoardParams) => (value: number) =>
    setParams((prev) => ({ ...prev, [key]: value }));

  // Helper function to create a control for Leva
  const createControl = (
    key: keyof BoardParams,
    min: number,
    max: number,
    step: number,
  ) => ({
    value: params[key],
    min,
    max,
    step,
    onChange: updateParam(key),
  });

  // Leva controls for board parameters
  if (helper)
    useControls(
      {
        outerX: createControl("outerX", 1, 10, 0.1),
        outerY: createControl("outerY", 1, 10, 0.1),
        outerZ: createControl("outerZ", 0.1, 2, 0.05),
        frame: createControl("frame", 0.1, 2, 0.05),
        depth: createControl("depth", 0.1, 1, 0.05),
        Save: createSaveButton(params, "boardParams.json"),
      },
      [params],
    );

  const { outerX, outerY, outerZ, frame, depth } = params;

  // Small delta to prevent z-fighting
  const delta = 0.001;
  // Validate dimensions to ensure proper geometry
  const validateDimensions = () => {
    if (outerX <= frame * 2 || outerY <= frame * 2) {
      console.error(
        `Invalid dimensions: Outer x (${outerX}) and y (${outerY}) must be greater than double the frame (${frame * 2}).`,
      );
      return false;
    }
    if (outerZ <= depth) {
      console.error(
        `Invalid dimensions: Outer z (${outerZ}) must be greater than depth (${depth}).`,
      );
      return false;
    }
    return true;
  };

  if (!validateDimensions()) return null;

  // Calculate outer and inner dimensions
  const outer = [outerX, outerY, outerZ];
  const inner = [
    outerX - frame * 2,
    outerY - frame * 2,
    outerZ - depth + delta,
  ];

  return (
    <mesh position={position} rotation={[0, -Math.PI / 2, 0]}>
      <Material />
      <Geometry>
        {" "}
        {/* Geometry for the board */}
        <Base geometry={new RoundedBoxGeometry(...outer, 4, 0.2)}></Base>
        <Subtraction
          geometry={new THREE.BoxGeometry(...inner)}
          position={[0, 0, depth / 2]}
        />
      </Geometry>
      <mesh position={[0, 0, -(outerZ / 2 - depth) + delta]}>
        {/* Plane for the board surface */}
        <planeGeometry args={[inner[0], inner[1]]} />
        {texture ? (
          <meshBasicMaterial map={texture} />
        ) : (
          <meshBasicMaterial map={placeHolder} />
        )}
      </mesh>
    </mesh>
  );
};

export default Board;
