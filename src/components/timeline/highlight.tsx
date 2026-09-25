import React, { useEffect } from "react";
import "./highlight.css";
import { useProjects } from "../../context/projectContext";
import { useKeyContext } from "../../context/keyContext";
import { FaPlay } from "react-icons/fa";
import { SiGithub } from "react-icons/si";
import TechStackRow from "./techGem";

const CloseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button className="close-button" onClick={onClick} aria-label="Close">
    &times;
  </button>
);

const ProjectImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <div className="highlight-image-wrap">
    <img src={src} alt={alt} className="highlight-image" loading="lazy" />
  </div>
);

const Header: React.FC<{ text: string | undefined }> = ({ text }) => (
  <div className="highlight-header">
    <h2>{text}</h2>
  </div>
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
    className="btn btn-demo"
    target="_blank"
    rel="noopener noreferrer"
  >
    <FaPlay aria-hidden="true" className="btn-icon" />
    <span>View Demo</span>
  </a>
);

const CodeButton: React.FC<{ link: string }> = ({ link }) => (
  <a
    href={link}
    className="btn btn-code"
    target="_blank"
    rel="noopener noreferrer"
  >
    <SiGithub aria-hidden="true" className="btn-icon" />
    <span>View Code</span>
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
        <CloseButton onClick={close} />

        {/* Same thumbnail the 3D board displays - the popup covers the
            board while it's open, so this keeps the artwork visible. */}
        {projectData.imagePath && (
          <ProjectImage
            src={projectData.imagePath}
            alt={`${projectData.title ?? "Project"} preview`}
          />
        )}

        <div className="highlight-body">
          <Header text={projectData.title} />

          {projectData.techStack && (
            <TechStackRow techStack={projectData.techStack} />
          )}

          {descriptionPoints && (
            <Description descriptionPoints={descriptionPoints} />
          )}

          <div className="button-group">
            {projectData.link && <DemoButton link={projectData.link} />}
            {projectData.githubLink && (
              <CodeButton link={projectData.githubLink} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Highlight;
