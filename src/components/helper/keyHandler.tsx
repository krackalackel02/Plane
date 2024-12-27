import { useEffect } from "react";
// Disable react/prop-types for this file
/* eslint-disable react/prop-types */
const KeyHandler: React.FC<{
  onKeyDown: (e: KeyboardEvent) => void;
  onKeyUp: (e: KeyboardEvent) => void;
}> = ({ onKeyDown, onKeyUp }) => {
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onKeyDown, onKeyUp]);

  return null; // This component doesn't render anything
};

export default KeyHandler;
