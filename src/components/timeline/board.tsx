import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";
import { Geometry, Base, Subtraction } from "@react-three/csg";

const Board = ({ imagePath }: { imagePath?: string }) => {
  // Load the image texture if provided
  const texture = imagePath ? useLoader(TextureLoader, imagePath) : null;

  // Frame and board dimensions
  const frame = 0.5; // Frame thickness
  const depth = 0.35; // Board thickness
  const outer = [4, 2.5, 0.5]; // Outer dimensions of the board
  const frameColor = 0xffffff; // Frame color
  const delta = 0.001; // Delta value for the subtraction operation

  // Validate the dimensions
  if (outer[0] <= frame * 2 || outer[1] <= frame * 2) {
    console.error(
      `Invalid dimensions: Outer x (${outer[0]}) and y (${outer[1]}) must be greater than double the frame (${frame * 2}).`,
    );
    return null; // Render nothing if invalid
  }

  if (outer[2] <= depth) {
    console.error(
      `Invalid dimensions: Outer z (${outer[2]}) must be greater than depth (${depth}).`,
    );
    return null; // Render nothing if invalid
  }

  // Inner cutout dimensions
  const inner = [outer[0] - frame * 2, outer[1] - frame * 2, outer[2] - depth];

  // Outer and inner geometries
  const outerBox = new THREE.BoxGeometry(...outer); // Outer dimensions
  const innerCutout = new THREE.BoxGeometry(...inner); // Inner cutout dimensions

  return (
    <>
      <mesh>
        {/* Apply material to the board frame */}
        <meshStandardMaterial color={frameColor} />
        <Geometry>
          {/* Outer box as base geometry */}
          <Base geometry={outerBox} />

          {/* Subtract inner cutout from the outer box */}
          <Subtraction geometry={innerCutout} position={[0, 0, depth / 2]} />
        </Geometry>

        {/* Add inner face (front face of inner cutout) */}
        <mesh position={[0, 0, -(outer[2] / 2 - depth) + delta]}>
          <planeGeometry args={[inner[0], inner[1]]} />
          {texture ? (
            <meshBasicMaterial map={texture} />
          ) : (
            <meshBasicMaterial color="red" />
          )}
        </mesh>
      </mesh>
    </>
  );
};

export default Board;
