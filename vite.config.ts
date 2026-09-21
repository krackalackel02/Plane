import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  base: "/Plane/", // Replace 'Plane' with your repository name
  build: {
    outDir: "dist", // Ensure this matches your workflow configuration
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js", // Point to the setup file
    exclude: ["**/node_modules/**", "e2e/**", ".claude/worktrees/**"], // e2e/ is Playwright's, not vitest's; don't scan into other worktrees nested under this repo
  },
});
