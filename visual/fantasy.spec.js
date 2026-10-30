import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { DEFAULT_SETTINGS } from "../src/music.js";

test("tablet map theme on start and completion", async ({ page }, info) => {
  await page.addInitScript((settings) => {
    localStorage.setItem("music-notes-settings-v1", JSON.stringify(settings));
  }, { ...DEFAULT_SETTINGS, clef: "treble", notes: ["C4"], roundLength: 0 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(async () => {
    const body = await document.fonts.load('700 20px "Inknut Antiqua"');
    const title = await document.fonts.load('700 20px "Grenze Gotisch"');
    return body.length > 0 && title.length > 0;
  })).toBe(true);
  await mkdir("screenshots/fantasy-review", { recursive: true });
  await page.screenshot({ path: `screenshots/fantasy-review/${info.project.name}-start.png` });
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const answer = page.getByRole("button", { name: "C", exact: true });
  await answer.hover();
  await page.screenshot({ path: `screenshots/fantasy-review/${info.project.name}-question-hover.png` });
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await answer.focus();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await answer.click();
  await expect(page.getByRole("heading", { name: "1 question completed" })).toBeVisible();
  await page.screenshot({ path: `screenshots/fantasy-review/${info.project.name}-complete.png` });
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});

test("standard quarter noteheads preserve pitch positions in both clefs", async ({ page }, info) => {
  for (const clef of ["treble", "bass"]) {
    const positions = [];
    for (const note of ["C4", "D4", "E4"]) {
      await page.goto("/");
      await page.evaluate((settings) => {
        localStorage.setItem("music-notes-settings-v1", JSON.stringify(settings));
      }, { ...DEFAULT_SETTINGS, clef, notes: [note] });
      await page.reload();
      await page.getByRole("button", { name: "Play", exact: true }).click();
      const head = page.locator(".vf-notehead text").first();
      await expect(head).toHaveCount(1);
      const noteData = await head.evaluate((element) => ({
        glyph: element.textContent.codePointAt(0),
        y: Number(element.getAttribute("y")),
      }));
      const line = await page.locator(".vf-stave path").last().getAttribute("d");
      const bottomLineY = Number(line.match(/^M[\d.]+ ([\d.]+)/)[1]);
      expect(noteData.glyph).toBe(0xe0a4);
      positions.push(noteData.y - bottomLineY);
      if (note === "C4") {
        await mkdir("screenshots/notehead-review", { recursive: true });
        await page.screenshot({ path: `screenshots/notehead-review/${info.project.name}-${clef}.png` });
      }
    }
    expect(positions[1] - positions[0]).toBeCloseTo(-5, 3);
    expect(positions[2] - positions[1]).toBeCloseTo(-5, 3);
  }
});
