import { Suspense, useEffect, useRef, useState } from "react";
import { useControls } from "leva";
import { Group, Mesh } from "three";
import Body from "../../components/ship/body";
import Exhaust from "../../components/ship/exhaust";
import { computeScale } from "../../utils/3d";
import {
  EXHAUST_MODE_ORDER,
  useExhaustModeContext,
} from "../../context/exhaustModeContext";
import { ExhaustMode } from "../../components/ship/exhaust/types";

// Matches the auto-fit target Ship/index.tsx scales the glTF to in the
// real scene (via computeScale against this same bounding box target) -
// without it the model would render at its raw (much tinier) native
// glTF scale, since that fit-up normally happens in Ship/index.tsx, which
// this sandbox intentionally bypasses (no physics/collision group).
const SCALE_TO = { x: 5, y: 3, z: 2 };

// Body/Exhaust take no props of their own (their look is driven by
// context + constants.json), so the controls here don't feed props
// directly - they drive a wrapping transform and the shared exhaust-mode
// context that Exhaust's renderer already reads from (see
// exhaustModeButton.tsx for the same live-switch pattern in the real HUD).
const ShipSandbox = () => {
  const groupRef = useRef<Group>(null);
  const [autoScale, setAutoScale] = useState(1);
  const { setMode } = useExhaustModeContext();

  const { scale, rotationY, exhaustMode } = useControls("Ship", {
    scale: { value: 1, min: 0.2, max: 3, step: 0.05 },
    rotationY: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01 },
    exhaustMode: { value: "voxels", options: EXHAUST_MODE_ORDER },
  });

  useEffect(() => {
    setMode(exhaustMode as ExhaustMode);
  }, [exhaustMode, setMode]);

  // One-shot bounding-box fit, same approach/target as Ship/index.tsx.
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox();
      const bbox = mesh.geometry.boundingBox;
      if (bbox) setAutoScale(computeScale(SCALE_TO, bbox));
    });
  }, []);

  return (
    <Suspense fallback={null}>
      <group
        ref={groupRef}
        scale={autoScale * scale}
        rotation={[0, rotationY, 0]}
      >
        <Body />
        <Exhaust />
      </group>
    </Suspense>
  );
};

export default ShipSandbox;
