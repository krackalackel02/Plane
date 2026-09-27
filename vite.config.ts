import { defineConfig } from "vitest/config";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
  base: "/Plane/", // Replace 'Plane' with your repository name
  build: {
    outDir: "dist", // Ensure this matches your workflow configuration
    rollupOptions: {
      // Multi-page build: sandbox.html is a separate entry so its code
      // (leva's panel, the component registry) never reaches the main
      // app's bundle - only visitors of /sandbox.html pay for it. Keyed
      // "index" (not e.g. "main") so the main entry's output chunk stays
      // named index-*.js - scripts/check-bundle-size.mjs greps for that
      // exact pattern to find the chunk it budgets.
      input: {
        index: resolve(__dirname, "index.html"),
        sandbox: resolve(__dirname, "sandbox.html"),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js", // Point to the setup file
    exclude: ["**/node_modules/**", "e2e/**", ".claude/worktrees/**"], // e2e/ is Playwright's, not vitest's; don't scan into other worktrees nested under this repo
  },
});
