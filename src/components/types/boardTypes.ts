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
