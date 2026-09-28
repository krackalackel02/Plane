export type BoardParams = {
  outerX: number;
  outerY: number;
  outerZ: number;
  frame: number;
  depth: number;
};

export interface boardJsonProps {
  id: string;
  title?: string;
  imagePath?: string;
  link?: string;
  githubLink?: string; // Add field for GitHub link
  description?: string;
  techStack?: string[]; // Add field for tech stack
}

// A board once placed on the planet's surface: a world position plus a full
// orientation quaternion (not just a Y angle) since boards standing upright
// around a sphere are tilted differently at every longitude.
export interface PositionedBoard extends boardJsonProps {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}
