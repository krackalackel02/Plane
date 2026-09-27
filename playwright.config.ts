import { defineConfig, devices } from "@playwright/test";

// End-to-end coverage for the mobile touch controls: runs against real
// mobile device emulation (real user-agent + real touch/PointerEvent
// support), which is the one thing jsdom-based component tests can't
// verify — that react-device-detect's MobileView gate actually activates.
export default defineConfig({
  testDir: "./e2e",
  // Runs against a built + `vite preview`d app (see `build:e2e` in
  // package.json), not the dev server. The build sets
  // VITE_E2E_TEST_HOOKS=true so window.__activeKeys / __setActiveProjectId
  // still ship (see src/utils/e2eTestHooks.ts — Vite's DEV/PROD flags
  // track serve-vs-build, not --mode, so they can't be used for this).
  // Switching off the dev server matters because concurrent contexts
  // against it raced its on-demand module compilation and caused real
  // flakiness (not a logic bug). `vite preview` just serves static
  // files, so there's nothing left to race and multiple workers are safe.
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173/Plane/",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "iPhone 17",
      use: { ...devices["iPhone 17"] },
    },
    {
      name: "Galaxy S24",
      use: { ...devices["Galaxy S24"] },
    },
  ],
  webServer: {
    // In CI, a dedicated build-e2e job builds once and each shard
    // downloads the resulting dist/ (see the workflows), so shards only
    // need to preview it. Locally there's no such upstream job, so
    // default to building it here too.
    command: process.env.CI
      ? "npm run preview:e2e"
      : "npm run build:e2e && npm run preview:e2e",
    url: "http://localhost:5173/Plane/",
    reuseExistingServer: !process.env.CI,
    // Build + preview startup take longer than the dev server did.
    timeout: 90_000,
  },
});
