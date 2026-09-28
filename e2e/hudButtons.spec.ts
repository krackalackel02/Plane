import { test, expect, type Locator, type Page } from "@playwright/test";

// Coverage for the shared top-right HUD button family (see hudCorner.tsx):
// AudioButton and ExhaustModeButton are both built on the RadialNodeMenu
// speed-dial template (radialNodeMenu.tsx). Its trigger is meant to open on
// a single tap on touch devices - there's no hover path on mobile, unlike
// desktop, where opening happens via mouseenter regardless of which exact
// descendant the cursor first lands on.
//
// The bug this guards against: .radial-node-menu__hover-bridge used to
// carry `pointer-events: auto` unconditionally, including while collapsed.
// Since it's `position: absolute; inset: 0`, it painted directly on top of
// the plain in-flow trigger <button> regardless of DOM order (a real CSS
// stacking rule, not a fluke) and silently absorbed every tap meant for
// the trigger. Desktop never noticed, because hovering into the wrapper
// opens the branch before any click is needed. Mobile has no such
// fallback, so the trigger was effectively dead until some other event
// (an inconsistent, browser-dependent touch->mouse compatibility path)
// happened to open it - exactly the "have to spam tap other buttons"
// symptom this was reported as.
//
// This is also the one thing radialNodeMenu.test.tsx's jsdom-based tests
// structurally cannot catch: RTL's fireEvent.click() dispatches straight
// on the target node, bypassing real browser hit-testing/paint-order
// entirely, so a sibling element sitting visually on top of the trigger
// never shows up as broken there.
//
// Real device emulation (isMobile + hasTouch, which is all this project's
// two Playwright projects run) is what actually exercises point-based hit
// testing - but Chromium's automated touch injection (locator.tap(), via
// CDP) does not reliably synthesize the compatibility `click` DOM event
// React's onClick depends on, even once a real device fires the same
// touch reliably. So rather than assert through that unreliable path, the
// tests below ask the browser directly, via document.elementFromPoint,
// which element a tap at the trigger's own coordinates would actually
// land on - the literal mechanism of the bug, verified against a real
// layout/paint engine that jsdom doesn't have.

const waitForSceneReady = async (page: Page) => {
  await page.goto("/");
  // #loading-screen only drops pointer-events (via .loading-screen--hidden)
  // when `ready` flips, but it stays mounted, fully opaque and on top
  // (z-index: 100) for a bit longer - and .scene-chrome (the HUD's
  // ancestor) is only ever `opacity: 0` before that, never `display:
  // none`, so the HUD buttons already have a real layout box and read as
  // "visible" to Playwright well before the app is actually interactive.
  // Waiting for the loading screen to fully unmount is the real signal.
  await expect(page.locator("#loading-screen")).toHaveCount(0, {
    timeout: 30000,
  });
};

// The real defect: does a tap/click at the trigger's own on-screen
// position actually land on the trigger (or one of its own descendants,
// e.g. the icon), rather than on some other element painted on top of it.
const hitTestsToItself = (trigger: Locator) =>
  trigger.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return hit === el || el.contains(hit);
  });

test.beforeEach(async ({ page }) => {
  await waitForSceneReady(page);
});

test("the audio trigger - not an invisible overlay - is what a tap actually hits while collapsed", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: /^Audio:/ });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  expect(await hitTestsToItself(trigger)).toBe(true);
});

test("the exhaust-style trigger - not an invisible overlay - is what a tap actually hits while collapsed", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: /^Exhaust style:/ });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  expect(await hitTestsToItself(trigger)).toBe(true);
});

test("hovering the audio trigger opens it, and clicking a fanned option selects it and closes the branch", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: /^Audio:/ });
  await expect(trigger).toBeVisible();

  await trigger.hover();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await page.getByRole("menuitemcheckbox", { name: "Mute" }).click();

  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toHaveAccessibleName(/Muted/);
});

test("hovering the exhaust trigger opens it, and clicking a fanned option switches the mode and closes the branch", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: /^Exhaust style:/ });
  await expect(trigger).toBeVisible();

  await trigger.hover();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await page
    .getByRole("menuitemradio", { name: "Switch exhaust style to Particles" })
    .click();

  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toHaveAccessibleName(/Particles/);
});
