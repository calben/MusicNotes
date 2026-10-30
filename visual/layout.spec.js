import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SETTINGS } from "../src/music.js";

// A small, focused capture set for tablet layout changes.
for (const mode of [
  "letters",
  "keyboard",
  "keyboard-letters",
  "flashcards",
]) {
  test(`${mode} tablet proportions`, async ({ page }, info) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (settings) => {
        localStorage.setItem(
          "music-notes-settings-v1",
          JSON.stringify(settings),
        );
      },
      {
        ...DEFAULT_SETTINGS,
        mode: mode === "flashcards" ? "flashcards" : "choice",
        questionTypes: mode === "flashcards" ? ["letters"] : [mode],
        clef: "treble",
        notes: ["C4"],
      },
    );
    await page.goto("/");
    if (mode !== "flashcards")
      await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    if (mode !== "keyboard-letters")
      await expect(
        page.locator(".card-front .music-staff svg, .practice-notation svg"),
      ).toBeVisible();

    const choices = page.locator(".answer-choice");
    if (await choices.count()) {
      const choice = await choices.first().boundingBox();
      expect(choice.height).toBe(56);
      expect(choice.width).toBe(80);
      const source = await page
        .locator(
          mode === "keyboard-letters" ? ".music-keyboard" : ".music-staff",
        )
        .boundingBox();
      expect(source.height).toBeGreaterThan(choice.height * 3);
    }

    const folder = path.resolve("screenshots/layout-review");
    await mkdir(folder, { recursive: true });
    async function capture(name) {
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const file = path.join(
        folder,
        `${info.project.name}-${mode}-${name}.png`,
      );
      await page.screenshot({
        path: file,
        animations: "disabled",
        fullPage: false,
      });
      await info.attach(name, { path: file, contentType: "image/png" });
    }

    if (mode === "flashcards") {
      await capture("front");
      const reveal = page.getByRole("button", { name: "Reveal answer" });
      const revealBox = await reveal.boundingBox();
      expect(revealBox.y + revealBox.height).toBeLessThan(page.viewportSize().height);
      await reveal.click();
    }
    if (await page.locator(".music-keyboard:visible").count()) {
      const keyboard = page
        .locator(".music-keyboard")
        .filter({ visible: true });
      const fits = await keyboard
        .locator(".music-keyboard__keys")
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
      expect(fits).toBe(true);
      const key = await keyboard
        .locator(".ReactPiano__Key--natural")
        .first()
        .boundingBox();
      expect(key.height).toBeGreaterThanOrEqual(220);
      expect(key.width).toBeGreaterThanOrEqual(44);
      await expect(
        page.getByRole("button", { name: /Higher keys|Lower keys/ }),
      ).toHaveCount(0);
    }
    if (mode !== "flashcards") {
      await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
      const actions = page.locator(".practice-question-actions");
      const controls = await (await actions.count() ? actions : page.locator(".practice-feedback")).boundingBox();
      expect(controls.y + controls.height).toBeLessThan(
        page.viewportSize().height,
      );
    }
    await capture("question");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
