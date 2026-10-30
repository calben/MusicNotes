import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { DEFAULT_SETTINGS } from "../src/music.js";

for (let index = 1; index <= 4; index += 1) {
  test(`dragon ${index} stays perched through a question`, async ({ page }, info) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((settings) => {
      Math.random = () => 0;
      localStorage.setItem("music-notes-settings-v1", JSON.stringify(settings));
    }, { ...DEFAULT_SETTINGS, clef: "treble", notes: ["C4"], roundLength: 0 });
    await page.goto("/");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const panel = page.locator(".practice-panel");
    const classBeforeQuestion = await panel.getAttribute("class");
    const assetUrl = `/src/assets/corner-dragon-${index}.png`;
    await panel.evaluate((element, url) => {
      element.style.setProperty("--dragon-image", `url("${url}")`);
    }, assetUrl);
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
    await expect(panel).toHaveClass(classBeforeQuestion);
    await page.getByRole("button", { name: "Play again", exact: true }).click();
    await expect(panel).not.toHaveClass(classBeforeQuestion);
    expect(errors).toEqual([]);
  });
}
