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
  await expect(answers).toHaveCount(4);
  await answers.filter({ hasNotText: "4 beats" }).first().click();
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

test("repeat-end dots sit in staff spaces and rest glyphs stay centered", async ({ page }) => {
  await openSymbols(page, { symbolIds: ["repeat-sign", "half-rest", "quarter-rest"] });
  await page.getByRole("button", { name: "Practice setup" }).click();
  const setup = page.getByRole("dialog", { name: "Practice setup" });
  await setup.locator(".symbol-category .category-toggle").filter({ hasText: "Rests" }).click();
  await setup.locator(".symbol-category .category-toggle").filter({ hasText: "Bar lines and repeats" }).click();

  const repeat = setup.locator(".symbol-pick").filter({ hasText: "Repeat sign" }).locator("svg");
  await expect(repeat).toBeVisible();
  const repeatGeometry = await repeat.evaluate(svg => ({
    dots: [...svg.querySelectorAll("circle")].map(dot => Number(dot.getAttribute("cy"))),
    bars: [...svg.querySelectorAll("line")].filter(line => line.getAttribute("x1") === line.getAttribute("x2") && line.getAttribute("x1") !== "").map(line => ({
      x: Number(line.getAttribute("x1")), width: Number(line.getAttribute("stroke-width")),
    })),
  }));
  expect(repeatGeometry.dots).toEqual([38.5, 49.5]);
  expect(repeatGeometry.bars).toEqual([{ x: 96, width: 2 }, { x: 108, width: 6 }]);

  for (const label of ["Half rest", "Quarter rest"]) {
    const restSvg = setup.locator(".symbol-pick").filter({ hasText: label }).locator("svg");
    await expect(restSvg).toBeVisible();
    const rendered = await restSvg.evaluate(svg => {
      const stave = svg.querySelector(".vf-stave");
      const note = svg.querySelector(".vf-stavenote");
      if (!stave || !note) return { found: false, lineCount: 0, delta: Infinity };
      const staveBox = stave.getBBox();
      const noteBox = note.getBBox();
      return {
        found: true,
        lineCount: stave.querySelectorAll("path").length,
        delta: (noteBox.x + noteBox.width / 2) - (staveBox.x + staveBox.width / 2),
        filter: getComputedStyle(svg).filter,
      };
    });
    expect(rendered.lineCount, `${label} should render all five staff lines`).toBe(5);
    expect(rendered.found && Math.abs(rendered.delta) < 1, `${label} should be horizontally centered on its staff: ${JSON.stringify(rendered)}`).toBe(true);
  }

  const selectedRestSvg = setup.locator(".symbol-pick.btn-primary").filter({ hasText: "Half rest" }).locator(".symbol-staff-svg");
  const selectedRepeatSvg = setup.locator(".symbol-pick.btn-primary").filter({ hasText: "Repeat sign" }).locator("svg");
  await expect(selectedRestSvg).toHaveCSS("filter", /brightness\(0\)/);
  await expect(selectedRepeatSvg).toHaveCSS("filter", /brightness\(0\)/);
  const clipped = await selectedRestSvg.evaluate(svg => {
    const image = svg.getBoundingClientRect();
    const container = svg.parentElement.getBoundingClientRect();
    return image.top < container.top - 1 || image.bottom > container.bottom + 1;
  });
  expect(clipped).toBe(false);
  await page.screenshot({ path: "screenshots/symbol-notation-tablet-qa.png" });
});

test("symbol staff stays centered after tablet orientation changes", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openSymbols(page, { symbolIds: ["half-rest"] });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const host = page.locator(".practice-panel .symbol-notation");
  const initialWidth = await host.evaluate(element => element.clientWidth);
  const initialCenterDelta = await host.locator(".vf-stavenote").evaluate(note => {
    const stave = note.closest("svg").querySelector(".vf-stave");
    const noteBox = note.getBBox();
    const staveBox = stave.getBBox();
    return (noteBox.x + noteBox.width / 2) - (staveBox.x + staveBox.width / 2);
  });
  expect(Math.abs(initialCenterDelta)).toBeLessThan(1);

  const viewport = page.viewportSize();
  await page.setViewportSize(viewport.width > viewport.height
    ? { width: 768, height: 1024 }
    : { width: 1024, height: 768 });
  await expect.poll(() => host.evaluate(element => element.clientWidth)).not.toBe(initialWidth);
  await expect.poll(() => host.locator(".vf-stavenote").evaluate(note => {
    const stave = note.closest("svg").querySelector(".vf-stave");
    const noteBox = note.getBBox();
    const staveBox = stave.getBBox();
    return Math.abs((noteBox.x + noteBox.width / 2) - (staveBox.x + staveBox.width / 2));
  })).toBeLessThan(1);
  expect(errors).toEqual([]);
});
