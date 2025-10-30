import React from "react";
import { Html } from "@react-three/drei";
import "./highlight.css";
import { useProjects } from "../../context/projectContext";
import { boardJsonProps } from "../types/types";
import { print } from "../../utils/common";
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

  return (
    // Add zIndexRange to ensure it's on top of other DOM elements.
    <Html position={position} visible={isVisible}>
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
