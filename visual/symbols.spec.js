import { test, expect } from "@playwright/test";
import { DEFAULT_SETTINGS } from "../src/music.js";

async function openSymbols(page, settings) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(value => localStorage.setItem("music-notes-settings-v1", JSON.stringify(value)), {
    ...DEFAULT_SETTINGS, notes: [], clef: "treble", symbolIds: ["whole-note"], roundLength: 0, ...settings,
  });
  await page.goto("/");
  return errors;
}

test("symbol-only practice scores answers and tracks weak symbols", async ({ page }) => {
  const errors = await openSymbols(page, {});
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByText(/How many beats.*4\/4/)).toBeVisible();
  const answers = page.locator("button.answer-choice");
  await expect(answers).toHaveCount(2);
  await answers.filter({ hasNotText: "4 beats" }).click();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  const progress = page.getByRole("dialog", { name: "Practice progress" });
  await expect(progress.getByText("Whole note")).toBeVisible();
  await progress.getByRole("button", { name: "Practice symbols that need more work" }).click();
  const setup = page.getByRole("dialog", { name: "Practice setup" });
  await expect(setup).toBeVisible();
  await setup.locator(".symbol-category .category-toggle").filter({ hasText: "Notes" }).click();
  await expect(setup.getByRole("button", { name: /Whole note/ })).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("category bulk selection preserves other categories and disclosures work by keyboard", async ({ page }) => {
  await openSymbols(page, { notes: ["C4"], symbolIds: ["quarter-rest"] });
  await page.getByRole("button", { name: "Practice setup" }).click();
  const setup = page.getByRole("dialog", { name: "Practice setup" });
  const notesCategory = setup.locator(".symbol-category").filter({ hasText: "Notes" });
  const noteToggle = setup.locator(".symbol-category .category-toggle").filter({ hasText: "Notes" });
  const restsCategory = setup.locator(".symbol-category").filter({ hasText: "Rests" });
  const restToggle = setup.locator(".symbol-category .category-toggle").filter({ hasText: "Rests" });
  const octave4 = setup.locator(".pitch-category .category-toggle").filter({ hasText: "Octave 4" });

  await expect(noteToggle).toHaveAttribute("aria-expanded", "false");
  await noteToggle.focus();
  await page.keyboard.press("Enter");
  await expect(noteToggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Space");
  await expect(noteToggle).toHaveAttribute("aria-expanded", "false");

  await notesCategory.getByRole("button", { name: "Select all Notes", exact: true }).click();
  await expect(notesCategory.locator(".category-count")).toHaveText("5/5");
  await expect(restToggle).toHaveAttribute("aria-expanded", "false");
  await expect(restsCategory.locator(".category-count")).toHaveText("1/3");
  await octave4.click();
  await expect(setup.getByRole("button", { name: "C4, selected" })).toHaveAttribute("aria-pressed", "true");

  await notesCategory.getByRole("button", { name: "Deselect all Notes", exact: true }).click();
  await expect(notesCategory.locator(".category-count")).toHaveText("0/5");
  await expect(restsCategory.locator(".category-count")).toHaveText("1/3");
  await expect(setup.getByRole("button", { name: "C4, selected" })).toHaveAttribute("aria-pressed", "true");
  await expect(setup.getByRole("button", { name: "Start practice" })).toBeEnabled();
});

test("symbol flashcards reveal the answer", async ({ page }) => {
  const errors = await openSymbols(page, { mode: "flashcards", symbolIds: ["quarter-rest"] });
  await expect(page.getByText("How many beats in 4/4?")).toBeVisible();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.getByText("1 beat", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
