import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { DEFAULT_SETTINGS } from "../src/music.js";

// A fixed random source makes each of the five possible dragons reviewable.
const seeds = [0.55, 0.05, 0.21, 0.30, 0.45];
for (let index = 1; index <= 5; index += 1) {
  test(`dragon ${index} stays perched through a question`, async ({ page }, info) => {
    if (info.project.name === "chromium-portrait" && index < 4) test.skip();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(({ seed, settings }) => {
      Math.random = () => seed;
      localStorage.setItem("music-notes-settings-v1", JSON.stringify(settings));
    }, { seed: seeds[index - 1], settings: { ...DEFAULT_SETTINGS, clef: "treble", notes: ["C4"], roundLength: 0 } });
    await page.goto("/");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const panel = page.locator(".practice-panel");
    await expect(panel).toHaveClass(new RegExp(`\\bdragon-${index}\\b`));
    const imageUrl = await panel.evaluate((element) => {
      const background = getComputedStyle(element, "::after").backgroundImage;
      return background.match(/url\(["']?(.*?)["']?\)/)?.[1];
    });
    expect(imageUrl).toBeTruthy();
    expect(await page.evaluate(async (url) => {
      const image = new Image();
      image.src = url;
      try { await image.decode(); return image.naturalWidth > 0; } catch { return false; }
    }, imageUrl)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    await mkdir("screenshots/dragon-review", { recursive: true });
    await page.screenshot({ path: `screenshots/dragon-review/${info.project.name}-dragon-${index}.png`, fullPage: false });
    await page.getByRole("button", { name: "C", exact: true }).click();
    await expect(page.getByRole("heading", { name: "1 question completed" })).toBeVisible();
    await expect(panel).toHaveClass(new RegExp(`\\bdragon-${index}\\b`));
    await page.getByRole("button", { name: "Play again", exact: true }).click();
    await expect(panel).not.toHaveClass(new RegExp(`\\bdragon-${index}\\b`));
    expect(errors).toEqual([]);
  });
}
