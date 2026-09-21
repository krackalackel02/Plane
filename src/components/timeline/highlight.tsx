import React, { useEffect } from "react";
import "./highlight.css";
import { useProjects } from "../../context/projectContext";
import { useKeyContext } from "../../context/keyContext";

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

/**
 * Modal shown when the ship activates a project board. Rendered once,
 * outside the R3F <Canvas> tree (see scene.tsx), as a plain fixed overlay
 * centered in the viewport — not anchored to the board's 3D position.
 *
 * It used to be mounted per-board *inside* the Canvas via drei's <Html>,
 * anchored to that board's projected 3D screen position with no clamping
 * against the viewport bounds: depending on where the board sat on screen,
 * the panel (including its own close button) could render partially or
 * fully off-screen. Living outside the 3D tree avoids that class of bug
 * entirely and makes the responsive CSS sizing meaningful on every screen.
 */
const Highlight: React.FC = () => {
  const { items, activeProjectId, setActiveProjectId } = useProjects();
  const activeKeys = useKeyContext();
  const projectData = items.find((item) => item.id === activeProjectId);
  const isVisible = projectData !== undefined;

  useEffect(() => {
    if (isVisible && activeKeys.has("Enter")) {
      activeKeys.delete("Enter");
      if (projectData?.link) {
        window.open(projectData.link, "_blank");
      }
      setActiveProjectId(null);
    }
  }, [isVisible, activeKeys, setActiveProjectId, projectData?.link]);

  if (!projectData) {
    return null;
  }

  const descriptionPoints = projectData.description
    ?.split("•")
    .filter((p) => p.trim() !== "");

  const close = () => setActiveProjectId(null);

  return (
    <div className="highlight-overlay" onClick={close}>
      <div
        className="highlight-content-3d"
        onClick={(event) => event.stopPropagation()}
      >
        <Header text={projectData.title}>
          <CloseButton onClick={close} />
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
    </div>
  );
};

export default Highlight;
