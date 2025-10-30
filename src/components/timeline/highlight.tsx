import React, { useEffect } from "react";
import { Html } from "@react-three/drei";
import "./highlight.css";
import { useProjects } from "../../context/projectContext";
import { boardJsonProps } from "../types/types";
import { print } from "../../utils/common";
import { useKeyContext } from "../../context/keyContext";
interface HighlightProps {
  position: [number, number, number];
  projectData: boardJsonProps;
}
const Highlight: React.FC<HighlightProps> = ({ position, projectData }) => {
  const { activeID, setActiveID } = useProjects();
  const isVisible = activeID === projectData.id;
  if (!isVisible) {
    print("Highlight not active for ID:", projectData.id); // Debugging line
    return null;
  }
  const activeKeys = useKeyContext();
  // Handle the 'Enter' key press as a side effect
  useEffect(() => {
    // Only proceed if a project is active and the 'Enter' key is pressed
    if (isVisible && activeKeys.has("Enter")) {
      // 1. Manually remove the 'Enter' key from the set to break the loop
      activeKeys.delete("Enter");

      // 2. Open the link if it exists
      if (projectData.link) {
        window.open(projectData.link, "_blank");
      }

      // 3. Close the highlight panel
      setActiveID(null);
    }
    // Run this effect whenever the active project or key set changes
  }, [isVisible, activeKeys, setActiveID]);

  const popupPosition: [number, number, number] = [
    position[0],
    position[1] + 2,
    position[2],
  ];

  return (
    // Add zIndexRange to ensure it's on top of other DOM elements.
    <Html position={popupPosition} visible={isVisible}>
      <div className="highlight-container">
        <div className="highlight-content-3d">
          <button className="close-button" onClick={() => setActiveID(null)}>
            &times;
          </button>
          <h2>{projectData.title}</h2>
          <p>{projectData.description}</p>
          {projectData.link && (
            <a
              href={projectData.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Project
            </a>
          )}
        </div>
      </div>
    </Html>
  );
};

export default Highlight;
