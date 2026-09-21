import React, { useEffect } from "react";
import { Html } from "@react-three/drei";
import "./highlight.css";
import { useProjects } from "../../context/projectContext";
import { boardJsonProps } from "../types/boardTypes";
import { useKeyContext } from "../../context/keyContext";
interface HighlightProps {
  projectData: boardJsonProps;
}

const CloseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button className="close-button" onClick={onClick}>
    &times;
  </button>
);

const Header: React.FC<{
  text: string | undefined;
  children: React.ReactNode;
}> = ({ text, children }) => (
  <div className="highlight-header">
    <h2>{text}</h2>
    {children}
  </div>
);

const TechStack: React.FC<{ techStack: string[] }> = ({ techStack }) => (
  <p className="tech-stack">
    <strong>Tech:</strong> {techStack.join(", ")}
  </p>
);

const Description: React.FC<{ descriptionPoints: string[] }> = ({
  descriptionPoints,
}) => (
  <ul className="description-list">
    {descriptionPoints.map((point, index) => (
      <li key={index}>{point.trim()}</li>
    ))}
  </ul>
);

const DemoButton: React.FC<{ link: string }> = ({ link }) => (
  <a
    href={link}
    className="btn btn-primary"
    target="_blank"
    rel="noopener noreferrer"
  >
    View Demo
  </a>
);

const GitHubButton: React.FC<{ link: string }> = ({ link }) => (
  <a
    href={link}
    className="btn btn-secondary"
    target="_blank"
    rel="noopener noreferrer"
  >
    View on GitHub
  </a>
);

const Highlight: React.FC<HighlightProps> = ({ projectData }) => {
  const { activeProjectId, setActiveProjectId } = useProjects();
  const isVisible = activeProjectId === projectData.id;
  if (!isVisible) {
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
      setActiveProjectId(null);
    }
    // Run this effect whenever the active project or key set changes
  }, [isVisible, activeKeys, setActiveProjectId]);

  const descriptionPoints = projectData.description
    ?.split("•")
    .filter((p) => p.trim() !== "");

  const offsetPosition: [number, number, number] = [0, 5, 0];

  return (
    // Add zIndexRange to ensure it's on top of other DOM elements.
    <Html position={offsetPosition} visible={isVisible}>
      <div className="highlight-content-3d">
        <Header text={projectData.title}>
          <CloseButton onClick={() => setActiveProjectId(null)} />
        </Header>

        {projectData.techStack && (
          <TechStack techStack={projectData.techStack} />
        )}

        {descriptionPoints && (
          <Description descriptionPoints={descriptionPoints} />
        )}

        <div className="button-group">
          {projectData.link && <DemoButton link={projectData.link} />}
          {projectData.githubLink && (
            <GitHubButton link={projectData.githubLink} />
          )}
        </div>
      </div>
    </Html>
  );
};

export default Highlight;
