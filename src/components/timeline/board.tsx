import { useMemo, useState } from "react";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";
import { Geometry, Base, Subtraction } from "@react-three/csg";

// Leva for UI controls
import { useControls } from "leva";

// Import board parameters from JSON
import boardParams from "../../utils/boardParams.json"; // Import JSON file
import { RoundedBoxGeometry } from "three-stdlib";
import { BoardParams } from "../types/boardTypes";
import { createSaveButton } from "../../utils/3d";
import ActivationZone from "./activationZone";
import Highlight from "./highlight";

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

interface PictureFrameProps {
  params: BoardParams;
  texture: THREE.Texture;
  debugValue?: string | number;
}

const PictureFrame = ({
  params,
  texture,
  debugValue, // NEW: Add debugValue prop
}: PictureFrameProps) => {
  const { outerX, outerY, outerZ, frame, depth } = params;

  const delta = 0.05;
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

  // NEW: Create a dynamic texture (either the image or the debug number)
  const displayTexture = useMemo(() => {
    if (debugValue === undefined) {
      return texture; // Use the original image texture
    }

    // Create canvas texture for debugging
    const canvas = document.createElement("canvas");
    const size = 256; // Texture size
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // 1. White background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, size, size);

      // 2. Black number
      ctx.fillStyle = "black";
      ctx.font = "bold 150px Arial"; // Large font
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(debugValue), size / 2, size / 2 + 10); // +10 for better vertical centering
    }

    const canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTexture.needsUpdate = true; // Ensure it updates
    return canvasTexture;
  }, [texture, debugValue]); // Re-run only if texture or debugValue changes

  if (!validateDimensions()) return null;

  const outer = [outerX, outerY, outerZ];
  const inner = [
    outerX - frame * 2,
    outerY - frame * 2,
    outerZ - depth + delta,
  ];

  return (
    <mesh rotation={[0, -Math.PI / 2, 0]}>
      <Material />
      <Geometry>
        <Base geometry={new RoundedBoxGeometry(...outer, 4, 0.2)}></Base>
        <Subtraction
          geometry={new THREE.BoxGeometry(...inner)}
          position={[0, 0, depth / 2]}
        />
      </Geometry>
      <mesh position={[0, 0, -(outerZ / 2 - depth) + delta]}>
        <planeGeometry args={[inner[0], inner[1]]} />

        {/* NEW: Use the dynamic displayTexture */}
        <meshBasicMaterial map={displayTexture} />
      </mesh>
    </mesh>
  );
};

export interface BoardProps {
  id: string;
  imagePath?: string;
  title?: string;
  link?: string;
  description?: string;
  githubLink?: string;
  techStack?: string[];
  helper?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  debug?: boolean;
}

/**
 * Board component for displaying a 3D board
 * @param id Unique identifier for the board
 * @param imagePath Path to the image texture
 * @param title Title of the board
 * @param link URL link associated with the board
 * @param description Description text for the board
 * @param githubLink GitHub link associated with the board
 * @param techStack Array of technologies used
 * @param helper Boolean to enable Leva controls
 * @param position 3D position of the board
 * @param rotation 3D rotation of the board
 * @param debug Boolean to enable debug mode (shows ID on board)
 * @returns JSX.Element
 */
const Board = ({
  id,
  imagePath,
  title,
  link,
  description,
  githubLink,
  techStack,
  helper = false,
  position = [4.0, 2.5, 0.5],
  rotation = [0, 0, 0], // Add rotation prop with a default
  debug = false,
}: BoardProps) => {
  // Combine default and custom parameters
  const initialValues: BoardParams = { ...defaultValues, ...boardParams };
  const [params, setParams] = useState(initialValues);
  const finalImage = imagePath || "./images/placeholder.jpg";
  const texture = useLoader(TextureLoader, finalImage);

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

  return (
    <group position={position} rotation={rotation}>
      <PictureFrame
        params={params}
        texture={texture}
        debugValue={debug ? id : undefined}
      />
      <ActivationZone
        id={id} // Positioned on the floor in front of the board
      />
      <Highlight
        projectData={{ id, title, description, link, githubLink, techStack }}
      />
    </group>
  );
};

export default Board;
