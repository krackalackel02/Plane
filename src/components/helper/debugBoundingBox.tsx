import React, { useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxHelper, Material, Object3D } from "three";
import { useDebugBounds } from "../../context/debugBoundsContext";

interface DebugBoundingBoxProps {
  // The object whose exact world-space bounding box to trace. Left null
  // until the target has mounted (e.g. a lazy-loaded model) - the box
  // simply stays hidden until then.
  target: React.RefObject<Object3D | null>;
  color?: string;
}

// Wireframe box traced exactly around `target`'s world-space bounding box -
// the "B" hotkey debug visualisation (see debugBoundsContext) used to check
// where an object's actual occupied space starts and ends. Recomputed every
// frame via BoxHelper.update() so it tracks moving targets (the ship) as
// well as static ones (boards).
const DebugBoundingBox: React.FC<DebugBoundingBoxProps> = ({
  target,
  color = "#39ff14",
}) => {
  const { enabled } = useDebugBounds();
  const [helper, setHelper] = useState<BoxHelper | null>(null);

  useEffect(() => {
    if (!enabled || !target.current) {
      setHelper(null);
      return;
    }
    const boxHelper = new BoxHelper(target.current, color);
    setHelper(boxHelper);
    return () => {
      boxHelper.geometry.dispose();
      (boxHelper.material as Material).dispose();
    };
  }, [enabled, target, color]);

  // BoxHelper only computes the box once, at construction - re-run its
  // update() every frame so a moving target (the ship) keeps the box glued
  // to it instead of leaving it stuck at the spawn position.
  useFrame(() => {
    helper?.update();
  });

  if (!helper) return null;
  return <primitive object={helper} />;
};

export default DebugBoundingBox;
