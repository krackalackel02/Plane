import { useState } from "react";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";
import { Geometry, Base, Subtraction } from "@react-three/csg";
import { useControls, button } from "leva";
import boardParams from "../../utils/boardParams.json"; // Import JSON file
import { RoundedBoxGeometry } from "three-stdlib";

type BoardParams = {
  outerX: number;
  outerY: number;
  outerZ: number;
  frame: number;
  depth: number;
  positionX: number;
  positionY: number;
  positionZ: number;
};

const defaultValues: BoardParams = {
  outerX: 6.7,
  outerY: 4.4,
  outerZ: 0.4,
  frame: 0.35,
  depth: 0.25,
  positionX: 4.0,
  positionY: 2.5,
  positionZ: 0.5,
};

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

const Board = ({
  imagePath,
  helper = false,
}: {
  imagePath?: string;
  helper?: boolean;
}) => {
  const initialValues: BoardParams = { ...defaultValues, ...boardParams };
  const [params, setParams] = useState(initialValues);
  const texture = imagePath ? useLoader(TextureLoader, imagePath) : null;
  const placeHolder = useLoader(TextureLoader, "./images/placeholder.jpg");

  const updateParam = (key: keyof BoardParams) => (value: number) =>
    setParams((prev) => ({ ...prev, [key]: value }));

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

  if (helper)
    useControls(
      {
        outerX: createControl("outerX", 1, 10, 0.1),
        outerY: createControl("outerY", 1, 10, 0.1),
        outerZ: createControl("outerZ", 0.1, 2, 0.05),
        frame: createControl("frame", 0.1, 2, 0.05),
        depth: createControl("depth", 0.1, 1, 0.05),
        positionX: createControl("positionX", 1, 10, 0.1),
        positionY: createControl("positionY", 1, 10, 0.1),
        positionZ: createControl("positionZ", 0.1, 2, 0.05),
        Save: button(() => {
          const blob = new Blob([JSON.stringify(params, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "boardParams.json";
          a.click();
          URL.revokeObjectURL(url);
        }),
      },
      [params],
    );

  const {
    outerX,
    outerY,
    outerZ,
    frame,
    depth,
    positionX,
    positionY,
    positionZ,
  } = params;

  const delta = 0.001;
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

  const outer = [outerX, outerY, outerZ];
  const inner = [
    outerX - frame * 2,
    outerY - frame * 2,
    outerZ - depth + delta,
  ];

  return (
    <mesh
      position={[positionX, positionY, positionZ]}
      rotation={[0, -Math.PI / 2, 0]}
    >
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
