import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Dev-only tool: sandbox.html is always servable via `vite`/`vite dev`
// (unaffected by rollupOptions.input below - the dev server serves any
// html file in the project root regardless), but it's left out of `vite
// build`'s output by default, so it never becomes part of the GitHub
// Pages deploy artifact (see .github/workflows/main.yaml's build job,
// which runs plain `npm run build`) and is never publicly reachable.
// Opt in locally with `VITE_INCLUDE_SANDBOX=true npm run build` if you
// need a built copy (e.g. `vite preview`) rather than the dev server.
const includeSandbox = process.env.VITE_INCLUDE_SANDBOX === "true";

// https://vite.dev/config/
export default defineConfig({
  base: "/Plane/", // Replace 'Plane' with your repository name
  build: {
    outDir: "dist", // Ensure this matches your workflow configuration
    rollupOptions: {
      // Keyed "index" (not e.g. "main") so the main entry's output chunk
      // stays named index-*.js - scripts/check-bundle-size.mjs greps for
      // that exact pattern to find the chunk it budgets. When sandbox.html
      // is included, it's a separate entry so its code (leva's panel, the
      // sandbox registry) never reaches the main app's bundle.
      input: includeSandbox
        ? {
            index: resolve(__dirname, "index.html"),
            sandbox: resolve(__dirname, "sandbox.html"),
          }
        : {
            index: resolve(__dirname, "index.html"),
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
