// Vite's DEV/PROD flags are tied to the command (serve vs build), not to
// --mode, so a built bundle is always DEV=false even under `vite build
// --mode test`. VITE_E2E_TEST_HOOKS is an explicit, separate switch the
// e2e build sets (see the `build:e2e` script) to keep window.__activeKeys
// / __setActiveProjectId in that one build without touching DEV/PROD.
// The real GitHub Pages build never sets it, so these hooks never ship
// there.
export const E2E_TEST_HOOKS_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_E2E_TEST_HOOKS === "true";
