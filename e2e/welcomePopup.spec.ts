import { test, expect, type Page } from "@playwright/test";

// Regression coverage for the intro popup's close button (welcomeOverlay.tsx),
// which looked fine but often ignored the first tap, for two reasons:
//
// 1. The title's box reached up under the button, and painted on top of it
//    (`.welcome-alert > *` gives every child z-index 2, and the title comes
//    later in the DOM): taps on the button's lower half landed on the title
//    and did nothing - on phones, with tighter padding, the centre too - so
//    the popup only went away on its own auto-dismiss timer.
// 2. While the text decrypted, the scrambled glyphs re-wrapped its lines,
//    resizing the centred panel every frame, so the button itself jumped
//    ~13px up and down under the finger (on WebKit) for the first seconds.
//
// jsdom can't see this - it's real layout, paint order and hit-testing - so
// it's checked here in a real browser, on the phone layouts and a desktop one.

test.setTimeout(90_000);

const appear = async (page: Page) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Welcome" });
  // Appears once the scene has loaded and the intro flythrough has landed.
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  return dialog;
};

const openPopup = async (page: Page) => {
  const dialog = await appear(page);
  // Past the panel's 0.4s tear-in, while its clip-path still hides parts of it.
  await page.waitForTimeout(600);
  const close = dialog.getByRole("button", { name: "Dismiss" });
  const box = await close.boundingBox();
  if (!box) throw new Error("the close button has no layout box");
  return { dialog, box };
};

const checks = () => {
  test("the close button holds still while the popup's text decrypts", async ({
    page,
  }) => {
    await appear(page);
    // From the end of the 0.4s tear-in (whose own keyframes deliberately jolt
    // the panel a couple of pixels) through the ~3s text reveal.
    await page.waitForTimeout(450);
    const tops = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const samples: number[] = [];
          const start = performance.now();
          const sample = () => {
            const button = document.querySelector(".welcome-alert-close");
            if (button) samples.push(button.getBoundingClientRect().top);
            if (performance.now() - start < 3000) requestAnimationFrame(sample);
            else resolve(samples);
          };
          requestAnimationFrame(sample);
        }),
    );
    // The panel's ambient glitch nudges it by up to a pixel, nothing more.
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1.5);
  });

  test("every point of the intro popup's round close button is the button itself", async ({
    page,
  }) => {
    await openPopup(page);
    // Its centre and a ring of points three-quarters of the way out - the
    // box read in the same step as the hit-tests, so nothing can move between.
    const missed = await page.evaluate(() => {
      const button = document.querySelector(".welcome-alert-close");
      if (!button) return ["no close button"];
      const b = button.getBoundingClientRect();
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const r = (Math.min(b.width, b.height) / 2) * 0.75;
      const points = [
        [cx, cy],
        ...Array.from({ length: 12 }, (_, i) => [
          cx + r * Math.cos((i * Math.PI) / 6),
          cy + r * Math.sin((i * Math.PI) / 6),
        ]),
      ];
      return (
        points
          .filter(
            ([x, y]) =>
              !document.elementFromPoint(x, y)?.closest(".welcome-alert-close"),
          )
          // Report what each missed point hit instead, for a readable failure.
          .map(([x, y]) => {
            const el = document.elementFromPoint(x, y);
            const what = el
              ? `${el.tagName.toLowerCase()}.${String(el.className).split(" ").join(".")}`
              : "nothing";
            return `${Math.round(x - cx)},${Math.round(y - cy)} hit ${what}`;
          })
      );
    });
    expect(missed).toEqual([]);
  });

  test("a single real tap or click on the lower half of close dismisses the popup", async ({
    page,
    isMobile,
  }) => {
    const { dialog, box } = await openPopup(page);
    // The lower half was the dead part.
    const x = box.x + box.width / 2;
    const y = box.y + box.height * 0.72;
    if (isMobile) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });
};

test.describe("phone layout", checks);

test.describe("desktop layout", () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  });
  checks();
});
