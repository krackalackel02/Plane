import { test, expect, type Page } from "@playwright/test";

// Coverage for the project popup (src/components/timeline/highlight.tsx):
// it used to be anchored to a board's projected 3D screen position with no
// clamping against the viewport, so depending on where the board sat on
// screen the panel — including its own close button — could render
// partially or fully off-screen, and its CTA buttons could overflow the
// card. These tests assert real layout via getBoundingClientRect() in a
// real browser (jsdom doesn't compute layout), not screenshots, so they
// stay meaningful as the CSS evolves without becoming a pixel-diff suite.

const openProject = (page: Page, id: string) =>
  page.evaluate((projectId) => window.__setActiveProjectId?.(projectId), id);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => typeof window.__setActiveProjectId))
    .toBe("function");
});

test("the popup stays fully within the viewport", async ({ page }) => {
  // match-ai has the longest description/tech-stack in boardItems.json —
  // the worst case for the panel outgrowing the viewport.
  await openProject(page, "match-ai");

  const card = page.locator(".highlight-content-3d");
  await expect(card).toBeVisible();

  const cardBox = await card.boundingBox();
  const viewport = page.viewportSize();
  if (!cardBox || !viewport) throw new Error("missing bounding box");

  expect(cardBox.x).toBeGreaterThanOrEqual(0);
  expect(cardBox.y).toBeGreaterThanOrEqual(0);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(viewport.height + 1);
});

test("the popup stays within the viewport at a desktop width too", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openProject(page, "match-ai");

  const card = page.locator(".highlight-content-3d");
  const cardBox = await card.boundingBox();
  if (!cardBox) throw new Error("missing bounding box");

  expect(cardBox.x).toBeGreaterThanOrEqual(0);
  expect(cardBox.y).toBeGreaterThanOrEqual(0);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(1281);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(801);
});

test("the CTA buttons never overflow the card", async ({ page }) => {
  await openProject(page, "match-ai");

  const card = page.locator(".highlight-content-3d");
  const cardBox = await card.boundingBox();
  if (!cardBox) throw new Error("missing card bounding box");

  const buttons = page.locator(".button-group .btn");
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const buttonBox = await buttons.nth(i).boundingBox();
    if (!buttonBox) throw new Error("missing button bounding box");

    expect(buttonBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
    expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(
      cardBox.x + cardBox.width + 1,
    );
  }
});

test("the close button closes the popup", async ({ page }) => {
  await openProject(page, "match-ai");

  const card = page.locator(".highlight-content-3d");
  await expect(card).toBeVisible();

  await page.locator(".close-button").click();
  await expect(card).toHaveCount(0);
});

test("clicking the backdrop closes the popup", async ({ page }) => {
  await openProject(page, "match-ai");

  const overlay = page.locator(".highlight-overlay");
  await expect(overlay).toBeVisible();

  // Click a corner of the overlay, outside the centered card.
  await overlay.click({ position: { x: 2, y: 2 } });
  await expect(overlay).toHaveCount(0);
});
