import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { useLoader, ThreeEvent } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";
import { useAutopilot } from "../../context/autopilotContext";
import { Geometry, Base, Subtraction } from "@react-three/csg";

// Leva's debug panel is only used when helper=true (never in production
// usage). Lazy-load it so leva and its deps (radix-ui, etc.) split into
// their own chunk instead of bloating the main bundle every visitor pays for.
const BoardDebugControls = lazy(() => import("./boardDebugControls"));

// Import board parameters from JSON
import boardParams from "../../utils/boardParams.json"; // Import JSON file
import { RoundedBoxGeometry } from "three-stdlib";
import { BoardParams } from "../types/boardTypes";
import { getBoardMatWorldPosition } from "../../utils/3d";
import ActivationZone from "./activationZone";
import DebugBoundingBox from "../helper/debugBoundingBox";

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

// Every board (8 of them) uses the same aluminium frame material. Share a
// single MeshStandardMaterial instance across all of them instead of
// building 8 identical ones - cuts redundant material/shader setup work
// during the scene's first render.
let sharedAluminiumMaterial: THREE.MeshStandardMaterial | null = null;

const useAluminiumMaterial = () => {
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

  return useMemo(() => {
    if (!sharedAluminiumMaterial) {
      sharedAluminiumMaterial = new THREE.MeshStandardMaterial({
        map: baseColorMap,
        metalnessMap: metallicMap,
        normalMap,
        roughnessMap,
        side: THREE.DoubleSide,
      });
    }
    return sharedAluminiumMaterial;
  }, [baseColorMap, metallicMap, normalMap, roughnessMap]);
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
  const material = useAluminiumMaterial();

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
      <primitive object={material} attach="material" />
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
  helper?: boolean;
  position?: [number, number, number];
  quaternion?: [number, number, number, number];
  debug?: boolean;
  // How far to the side of the trail centerline the visual frame sits (its
  // own local Z, the lateral/width axis - see boardCollision.ts's doc
  // comment), positive or negative to alternate sides. The board's own
  // position/quaternion stay pinned to the trail centerline throughout -
  // this only shifts the rendered PictureFrame, not ActivationZone, so the
  // interactive mat stays centered on the flight path while the boards
  // flank it left and right as you fly past.
  sideOffset?: number;
}

/**
 * Board component for displaying a 3D board
 * @param id Unique identifier for the board
 * @param imagePath Path to the image texture
 * @param helper Boolean to enable Leva controls
 * @param position 3D position of the trail-centerline anchor for this stop
 * @param quaternion Orientation of that anchor, facing along the trail
 * @param debug Boolean to enable debug mode (shows ID on board)
 * @param sideOffset Lateral offset of the visual board off the centerline
 * @returns JSX.Element
 */
const Board = ({
  id,
  imagePath,
  helper = false,
  position = [4.0, 2.5, 0.5],
  quaternion = [0, 0, 0, 1],
  debug = false,
  sideOffset = 0,
}: BoardProps) => {
  // Combine default and custom parameters
  const initialValues: BoardParams = { ...defaultValues, ...boardParams };
  const [params, setParams] = useState(initialValues);
  const finalImage = imagePath || "./images/placeholder.jpg";
  const texture = useLoader(TextureLoader, finalImage);
  const { requestAutopilot } = useAutopilot();
  // Wraps just the picture frame (not ActivationZone's floor mat) so the
  // "B"-hotkey debug bounding box traces the board's own physical footprint.
  const frameRef = useRef<THREE.Group>(null);

  // Clicking either the picture frame or its floor mat (ActivationZone)
  // bubbles up to this single handler - both should fly to the same mat
  // center. Mirrors ActivationZone's own fixed local offset/rotation.
  const handleAutopilotClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    requestAutopilot(getBoardMatWorldPosition(position, quaternion));
  };

  // Function to update a specific parameter
  const updateParam = (key: keyof BoardParams) => (value: number) =>
    setParams((prev) => ({ ...prev, [key]: value }));

  return (
    <group
      position={position}
      quaternion={quaternion}
      onClick={handleAutopilotClick}
    >
      {helper && (
        <Suspense fallback={null}>
          <BoardDebugControls params={params} updateParam={updateParam} />
        </Suspense>
      )}
      {/* frameRef sits on this offset group itself (not a level deeper) so
          the "B"-hotkey debug box traces the picture frame's actual
          rendered position, sideOffset included. */}
      <group ref={frameRef} position={[0, 0, sideOffset]}>
        <PictureFrame
          params={params}
          texture={texture}
          debugValue={debug ? id : undefined}
        />
      </group>
      <ActivationZone
        id={id} // Centered on the trail, in front of the anchor - not the (offset) board
      />
      <DebugBoundingBox target={frameRef} color="#ffae00" />
    </group>
  );
};

export default Board;
