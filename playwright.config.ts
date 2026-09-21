import { defineConfig, devices } from "@playwright/test";

// End-to-end coverage for the mobile touch controls: runs against real
// mobile device emulation (real user-agent + real touch/PointerEvent
// support), which is the one thing jsdom-based component tests can't
// verify — that react-device-detect's MobileView gate actually activates.
export default defineConfig({
  testDir: "./e2e",
  // All projects share one dev server (needed for the DEV-only
  // window.__activeKeys hook — a production preview build wouldn't have
  // it). Too many concurrent browser contexts against that single server
  // caused real flakiness (slow module compilation, not a logic bug), so
  // keep this suite serial rather than fullyParallel.
  workers: 1,
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
    command: "npm run dev",
    url: "http://localhost:5173/Plane/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
