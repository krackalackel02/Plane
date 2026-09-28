import { test, expect, type Locator, type Page } from "@playwright/test";

// Coverage for the shared top-right HUD button family (see hudCorner.tsx):
// AudioButton and ExhaustModeButton are both built on the RadialNodeMenu
// speed-dial template (radialNodeMenu.tsx). Its trigger is meant to open on
// a single tap on touch devices - there's no hover path on mobile, unlike
// desktop, where opening happens via a mouse actually entering the wrapper.
//
// Two independent bugs used to make that fail on real touch devices, both
// invisible to radialNodeMenu.test.tsx's jsdom-based tests - RTL's
// fireEvent dispatches straight on a target node, bypassing both real
// hit-testing/paint order and a real browser's pointerType, so neither of
// these ever showed up there:
//
// 1. .radial-node-menu__hover-bridge used to carry `pointer-events: auto`
//    unconditionally, including while collapsed. Since it's `position:
//    absolute; inset: 0`, it painted directly on top of the plain in-flow
//    trigger <button> regardless of DOM order (a real CSS stacking rule,
//    not a fluke) and silently absorbed every tap meant for the trigger.
// 2. The wrapper's hover-to-open handler used to be a plain onMouseEnter/
//    onMouseLeave. Touch taps also fire the legacy mouseover/mouseout
//    compatibility events those are derived from, so a tap's synthesized
//    "mouseenter" opened the branch via hover, and the trigger's onClick
//    (a blind `!current` toggle) immediately flipped it back closed in the
//    same tap - it took a second tap to actually land it open.
//
// Both together produced exactly the reported symptom: tapping the audio
// or exhaust-style button did nothing, or needed repeated taps, while
// HelpButton (no hover state, no overlay) already opened on one tap.
//
// The elementFromPoint checks below target bug #1 directly (the literal
// hit-testing mechanism) rather than asserting through a live tap, since a
// live tap's outcome is also downstream of #2. The single-tap flows
// further down exercise the full real thing end-to-end, now that both are
// fixed - they reliably failed (via a genuinely unopened branch, not a
// tooling flake) against either bug alone.

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

test("a single real tap opens the audio trigger (no second tap needed)", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: /^Audio:/ });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.tap();

  await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

test("a single real tap opens the exhaust-style trigger (no second tap needed)", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: /^Exhaust style:/ });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.tap();

  await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

test("a single real tap on a fanned option selects it and closes the branch", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: /^Audio:/ });
  await expect(trigger).toBeVisible();

  await trigger.tap();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await page.getByRole("menuitemcheckbox", { name: "Mute" }).tap();

  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toHaveAccessibleName(/Muted/);
});
