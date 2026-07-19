// Generator smoke: boot the studio, see the canvas and the numbered sidebar,
// fail on ANY uncaught page error. The § GENERATE panel is expected to report
// "no backend" here — that is a healthy state, not a failure.
import { test, expect } from "@playwright/test";

test("boots the studio without a runtime error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText("BRAND ASSET GENERATOR").first()).toBeVisible();
  // The artwork canvas must exist and have real dimensions.
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const size = await canvas.evaluate((c) => ({ w: (c as HTMLCanvasElement).width, h: (c as HTMLCanvasElement).height }));
  expect(size.w).toBeGreaterThan(0);
  expect(size.h).toBeGreaterThan(0);
  expect(errors, `uncaught page errors:\n${errors.join("\n")}`).toEqual([]);
});

test("format sections are numbered and a format switch survives", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page.getByText(/§ 01/).first()).toBeVisible();
  // Switching a format re-renders the whole canvas pipeline.
  const story = page.getByText("Instagram Story").first();
  if (await story.isVisible().catch(() => false)) {
    await story.click();
    await page.waitForTimeout(500);
  }
  expect(errors, `uncaught page errors:\n${errors.join("\n")}`).toEqual([]);
});
