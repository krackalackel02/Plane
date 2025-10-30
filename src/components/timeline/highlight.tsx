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
  //TODO: 2nd button isnt appearing
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
  const descriptionPoints = projectData.description
    ?.split("•")
    .filter((p) => p.trim() !== "");
  return (
    // Add zIndexRange to ensure it's on top of other DOM elements.
    <Html position={popupPosition} visible={isVisible}>
      <div className="highlight-content-3d">
        <div className="highlight-header">
          <h2>{projectData.title}</h2>
          <button className="close-button" onClick={() => setActiveID(null)}>
            &times;
          </button>
        </div>

        {projectData.techStack && (
          <p className="tech-stack">
            <strong>Tech:</strong> {projectData.techStack.join(", ")}
          </p>
        )}

        {descriptionPoints && (
          <ul className="description-list">
            {descriptionPoints.map((point, index) => (
              <li key={index}>{point.trim()}</li>
            ))}
          </ul>
        )}

        <div className="button-group">
          {projectData.link && (
            <a
              href={projectData.link}
              className="btn btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Project
            </a>
          )}
          {projectData.githubLink && (
            <a
              href={projectData.githubLink}
              className="btn btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          )}
        </div>
      </div>
    </Html>
  );
};

export default Highlight;
