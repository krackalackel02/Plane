import { test, expect, type Locator, type Page } from "@playwright/test";

// Reads the KeyProvider's dev-only window.__activeKeys hook (see
// src/context/keyContext.tsx) — the only way to observe which keys a
// touch drag actually produced from outside React.
const activeKeys = (page: Page) =>
  page.evaluate(() => Array.from(window.__activeKeys ?? []));

// Under Playwright's mobile device emulation (isMobile + hasTouch),
// page.mouse.down()/move() do not reliably reach onPointerDown/Move
// handlers. Dispatching real PointerEvents directly on the target element
// does, and is exactly what a touch drag looks like from the handler's
// point of view (same pointerId throughout, clientX/clientY set).
const pointerDown = (
  locator: Locator,
  clientX: number,
  clientY: number,
  pointerId = 1,
) =>
  locator.dispatchEvent("pointerdown", {
    pointerId,
    clientX,
    clientY,
    bubbles: true,
  });

const pointerMove = (
  locator: Locator,
  clientX: number,
  clientY: number,
  pointerId = 1,
) =>
  locator.dispatchEvent("pointermove", {
    pointerId,
    clientX,
    clientY,
    bubbles: true,
  });

const pointerUp = (locator: Locator, pointerId = 1) =>
  locator.dispatchEvent("pointerup", { pointerId, bubbles: true });

const dragBy = async (
  locator: Locator,
  dx: number,
  dy: number,
  pointerId = 1,
) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("stick track has no bounding box");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await pointerDown(locator, startX, startY, pointerId);
  await pointerMove(locator, startX + dx, startY + dy, pointerId);
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("the joystick is visible on a real mobile device context", async ({
  page,
}) => {
  // This is the check that jsdom-based component tests cannot do: confirm
  // react-device-detect's MobileView gate actually activates for a real
  // mobile user-agent, not just that the component renders when mocked.
  await expect(page.locator(".circular-stick-track")).toBeVisible();
});

test("presses w when dragged up, and releases on lift", async ({ page }) => {
  const track = page.locator(".circular-stick-track");

  await dragBy(track, 0, -30); // up past the deadzone
  await expect.poll(() => activeKeys(page)).toContain("w");

  await pointerUp(track);
  await expect.poll(() => activeKeys(page)).not.toContain("w");
});

test("presses s when dragged down", async ({ page }) => {
  const track = page.locator(".circular-stick-track");

  await dragBy(track, 0, 30); // down past the deadzone
  await expect.poll(() => activeKeys(page)).toContain("s");

  await pointerUp(track);
});

test("presses d (turn right) when dragged right, and releases on lift", async ({
  page,
}) => {
  const track = page.locator(".circular-stick-track");

  await dragBy(track, 30, 0); // right past the deadzone
  await expect.poll(() => activeKeys(page)).toContain("d");

  await pointerUp(track);
  await expect.poll(() => activeKeys(page)).not.toContain("d");
});

test("presses a (turn left) when dragged left", async ({ page }) => {
  const track = page.locator(".circular-stick-track");

  await dragBy(track, -30, 0); // left past the deadzone
  await expect.poll(() => activeKeys(page)).toContain("a");

  await pointerUp(track);
});

test("dragging within the deadzone presses nothing", async ({ page }) => {
  const track = page.locator(".circular-stick-track");

  await dragBy(track, 5, 5); // well under the combined deadzone threshold
  await page.waitForTimeout(100);
  expect(await activeKeys(page)).toEqual([]);

  await pointerUp(track);
});

test("throttle and yaw engage together on a diagonal drag", async ({
  page,
}) => {
  const track = page.locator(".circular-stick-track");

  await dragBy(track, 28, -28); // up-right diagonal

  await expect
    .poll(() => activeKeys(page))
    .toEqual(expect.arrayContaining(["w", "d"]));

  await pointerUp(track);
  await expect.poll(() => activeKeys(page)).toEqual([]);
});
