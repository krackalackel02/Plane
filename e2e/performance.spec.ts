import { test, expect } from "@playwright/test";

// Regression coverage for the initial-load fix (src/components/scene.tsx):
// the minimap/joystick/HUD are plain DOM chrome rendered outside the
// Canvas, and used to pop in before the 3D scene (ship model + board
// textures) had actually finished loading - jarring, and exactly the kind
// of thing that's easy to silently reintroduce. Scene now gates that
// chrome behind a real "scene ready" signal (drei's useProgress) and
// fades both in together; these tests guard against that regression and
// against a gross load-time blowup (e.g. a huge new eagerly-loaded asset).

const CHROME = ".scene-chrome";
const LOADING_SCREEN = "#loading-screen";

test("the UI chrome does not appear before the 3D scene is ready", async ({
  page,
}) => {
  // Slow the ship model down enough to give a reliable window to assert
  // the chrome is still hidden mid-load, rather than racing a real (fast,
  // localhost) asset fetch.
  await page.route("**/models/ship.glb", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await page.goto("/");

  // Still mid-load: loading screen up, chrome not revealed yet.
  await expect(page.locator(LOADING_SCREEN)).not.toHaveClass(
    /loading-screen--hidden/,
  );
  await expect(page.locator(CHROME)).not.toHaveClass(/scene-chrome--visible/);

  // Once the (artificially slow) ship model resolves, both flip together.
  await expect(page.locator(CHROME)).toHaveClass(/scene-chrome--visible/, {
    timeout: 10_000,
  });
  await expect(page.locator(LOADING_SCREEN)).toHaveClass(
    /loading-screen--hidden/,
  );
});

test("the scene becomes ready within an acceptable load-time budget", async ({
  page,
}) => {
  const start = Date.now();
  await page.goto("/");
  await expect(page.locator(CHROME)).toHaveClass(/scene-chrome--visible/, {
    timeout: 8_000,
  });
  const elapsedMs = Date.now() - start;

  // Generous budget for a headless CI runner loading everything from
  // localhost - not meant to catch small regressions, just a gross one
  // (a huge new asset, or the ready-gate hanging and falling back to its
  // own internal 8s safety timeout in scene.tsx).
  expect(elapsedMs).toBeLessThan(6000);
});
