import { Suspense } from "react";
import Board from "../../components/timeline/board";

// Centers the real Board component at the origin with its debug controls
// switched on (helper=true), reusing the same leva tuning panel
// (outerX/Y/Z, frame, depth + a Save button) that board.tsx's own
// helper prop already provides - see boardDebugControls.tsx. No changes
// to board.tsx were needed to support this.
const BoardSandbox = () => (
  <Suspense fallback={null}>
    <Board id="sandbox" helper position={[0, 0, 0]} quaternion={[0, 0, 0, 1]} />
  </Suspense>
);

export default BoardSandbox;
