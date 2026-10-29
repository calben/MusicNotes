import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { DEFAULT_SETTINGS } from "../src/music.js";

const browserErrors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

async function openWithSettings(page, settings) {
  await page.addInitScript((value) => {
    localStorage.setItem("music-notes-settings-v1", JSON.stringify(value));
  }, { ...DEFAULT_SETTINGS, ...settings });
  await page.goto("/");
}

test("question types persist in both practice formats", async ({ page }, info) => {
  await openWithSettings(page, { mode: "choice", questionTypes: ["guided", "keyboard"] });
  await page.getByRole("button", { name: "Practice setup" }).click();
  const types = page.getByRole("group", { name: "Question types" });
  const allLetters = types.getByRole("button", { name: "All letters" });
  await expect(allLetters).toHaveAttribute("aria-pressed", "false");
  await allLetters.click();
  await expect(page.getByText(/Speak directions automatically/)).toHaveCount(0);
  await types.scrollIntoViewIfNeeded();
  await mkdir("screenshots/layout-review", { recursive: true });
  await page.screenshot({ path: `screenshots/layout-review/${info.project.name}-choice-setup.png` });
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: /Start practice/ }).click();
  await page.getByRole("button", { name: "Practice setup" }).click();
  await expect(allLetters).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Flashcards", exact: false }).first().click();
  await expect(allLetters).toHaveAttribute("aria-pressed", "true");
  await types.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `screenshots/layout-review/${info.project.name}-flashcards-setup.png` });
});

test("flashcards use the selected question direction", async ({ page }, info) => {
  await openWithSettings(page, {
    mode: "flashcards",
    questionTypes: ["keyboard-letters"],
    clef: "treble",
    notes: ["C4"],
  });
  await expect(page.getByRole("heading", { name: "What letter is this piano key?" })).toBeVisible();
  await expect(page.locator(".card-front .music-keyboard__key-target")).toHaveCount(1);
  await mkdir("screenshots/layout-review", { recursive: true });
  await page.screenshot({ path: `screenshots/layout-review/${info.project.name}-flashcard-keyboard-to-letter.png` });
});

test("a missed note appears in parent progress and opens focused setup", async ({ page }, info) => {
  await openWithSettings(page, { mode: "choice", questionTypes: ["guided"], clef: "treble", notes: ["C4"], choiceCount: 2 });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.locator("button.answer-choice").filter({ hasNotText: "C" }).first().click();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  const progress = page.getByRole("dialog", { name: "Practice progress" });
  await expect(progress.getByRole("row", { name: /C4/ })).toContainText("0 / 1");
  await expect(progress.getByRole("row", { name: /C4/ })).toContainText("More practice");
  await mkdir("screenshots/layout-review", { recursive: true });
  await page.screenshot({ path: `screenshots/layout-review/${info.project.name}-parent-progress.png` });
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await progress.getByRole("button", { name: "Practice notes that need more work" }).click();
  const setup = page.getByRole("dialog", { name: "Practice setup" });
  await expect(setup).toBeVisible();
  await setup.locator(".pitch-category .category-toggle").filter({ hasText: "Octave 4" }).click();
  await expect(setup.getByRole("button", { name: "C4, selected" })).toHaveAttribute("aria-pressed", "true");
});

test("repeated wrong letter answers do not reveal or force the correct answer", async ({ page }) => {
  await openWithSettings(page, { mode: "choice", questionTypes: ["guided"], clef: "treble", notes: ["C4"], choiceCount: 2 });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const wrong = page.locator("button.answer-choice").filter({ hasNotText: "C" }).first();
  await wrong.click();
  await wrong.click();
  await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
  const correct = page.getByRole("button", { name: "C", exact: true });
  await expect(correct).toBeEnabled();
  await expect(correct).toHaveClass(/btn-primary/);
  await expect(page.locator(".practice-feedback")).toHaveText("Not quite. Try again.");
  await correct.click();
  await expect(page.locator(".practice-feedback")).toHaveText("C is correct.");
});

test("wrong piano keys do not expose the answer", async ({ page }) => {
  await openWithSettings(page, { mode: "choice", questionTypes: ["keyboard"], clef: "treble", notes: ["C4"] });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const wrongKey = page.getByRole("button", { name: "D4", exact: true });
  await wrongKey.click();
  await wrongKey.click();
  await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
  await expect(page.locator(".music-keyboard__key-target")).toHaveCount(0);
  await page.getByRole("button", { name: /C4, Middle C/ }).click();
  await expect(page.locator(".practice-feedback")).toHaveText("C is correct.");
});
