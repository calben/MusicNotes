import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SETTINGS } from "../src/music.js";

const defaults = {
  mode: "choice", questionTypes: ["letters"], clef: "treble", notes: ["C4"],
  noCrossingHands: true, roundLength: 0,
};
const slug = (value) => value.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const browserErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  // Repeatable choices without replacing application state or event handlers.
  await page.addInitScript(() => {
    const settings = sessionStorage.getItem("visual-settings");
    if (settings) localStorage.setItem("music-notes-settings-v1", settings);
    let seed = 42;
    Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  });
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), "browser runtime errors").toEqual([]);
});

async function open(page, settings = {}) {
  await page.goto("/");
  await page.evaluate((value) => {
    sessionStorage.setItem("visual-settings", JSON.stringify(value));
  }, { ...defaults, ...settings });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
}

async function capture(page, info, name, locator = null, audit = true) {
  if (audit) {
    // Let layout and 3D flip compositing settle; correct-feedback captures use
    // a paused clock and deliberately skip animation frames.
    await page.evaluate(() => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  const folder = path.resolve(process.env.VISUAL_OUTPUT || "screenshots/review", info.project.name, slug(info.title));
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, `${slug(name)}.png`);
  if (locator) await locator.scrollIntoViewIfNeeded();
  await page.screenshot({ path: file, fullPage: false, animations: "disabled" });
  await info.attach(name, { path: file, contentType: "image/png" });
  if (!locator && audit) {
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const layout = await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      controls: [...document.querySelectorAll("button, input, [role=button]")]
        .filter((element) => element.checkVisibility() && !element.closest("[inert]"))
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            name: element.getAttribute("aria-label") || element.textContent.trim(),
            width: Math.round(box.width), height: Math.round(box.height),
            clipped: element.scrollWidth > element.clientWidth + 2,
          };
        }),
    }));
    await writeFile(file.replace(/\.png$/, ".json"), JSON.stringify({
      name, viewport: page.viewportSize(), layout,
      violations: accessibility.violations.map(({ id, impact, description, nodes }) => ({
        id, impact, description,
        nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      })),
      manualChecks: accessibility.incomplete.map(({ id, nodes }) => ({
        id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      })),
    }, null, 2));
    expect(layout.documentOverflow, `${name}: page must not scroll horizontally`).toBe(false);
    expect(accessibility.violations, `${name}: accessibility violations`).toEqual([]);
    expect(layout.controls.filter((control) => control.clipped), `${name}: clipped control text`).toEqual([]);
  }
}

async function buttonStates(page, info, selector, label) {
  const button = page.locator(selector).filter({ visible: true }).first();
  await capture(page, info, `${label}-normal`, button);
  await button.hover();
  await capture(page, info, `${label}-hover`, button);
  await page.mouse.move(0, 0);
  await button.focus();
  await capture(page, info, `${label}-focus`, button);
  await button.evaluate((element) => element.blur());
}

async function freeze(page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
}

test("setup and every configuration control", async ({ page }, info) => {
  await open(page, { clef: "both" });
  await page.getByRole("button", { name: "Practice setup" }).click();
  const dialog = page.getByRole("dialog");
  await capture(page, info, "setup-top");
  const controls = dialog.locator("button, input");
  for (let i = 0; i < await controls.count(); i++) {
    const control = controls.nth(i);
    const label = await control.evaluate((element) =>
      element.getAttribute("aria-label") || element.textContent.trim() || element.type);
    await capture(page, info, `control-${String(i).padStart(2, "0")}-${label}`, control);
  }
  for (const selector of [".mode-fieldset", ".practice-options", ".clef-fieldset", ".pitch-groups"]) {
    await capture(page, info, `section-${selector}`, page.locator(selector));
  }
  for (const variant of ["primary", "outline", "ghost"]) {
    await buttonStates(page, info, `dialog .btn-${variant}`, `setup-${variant}`);
  }
  for (const label of ["Staff to letter", "Piano keys", "Keyboard to letter", "Flashcards"]) {
    await dialog.getByRole("button", { name: label, exact: false }).first().click();
    await page.locator(".mode-fieldset").scrollIntoViewIfNeeded();
    await capture(page, info, `setup-${label}`);
    if (label !== "Flashcards") {
      await capture(page, info, `options-${label}`, page.locator(".practice-options"));
    }
  }
  await dialog.getByRole("button", { name: "Staff to letter", exact: false }).click();
  await page.getByRole("checkbox", { name: "No crossing hands", exact: false }).uncheck();
  await capture(page, info, "no-crossing-off", page.locator(".clef-fieldset + .toggle-option"));
  for (const name of ["Starter", "Treble staff", "Bass staff"]) {
    await dialog.getByRole("button", { name, exact: true }).click();
    await capture(page, info, `preset-${name}`, page.locator(".pitch-groups"));
  }
  await dialog.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Start practice" })).toBeDisabled();
  await capture(page, info, "empty-selection-disabled");
  await capture(page, info, "disabled-start", dialog.getByRole("button", { name: "Start practice" }));
});

test("start requires playable cards and symbol-only instruction ignores pitches", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Practice setup" }).click();
  const dialog = page.getByRole("dialog");
  const start = dialog.getByRole("button", { name: "Start practice" });

  await dialog.getByRole("button", { name: "Staff to Letter", exact: true }).click();
  await expect(start).toBeDisabled();
  await expect(dialog.getByRole("status")).toHaveText("Select a note question type or add a musical symbol.");

  await dialog.locator(".symbol-category").first().locator(".category-actions button").first().click();
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.locator(".practice-instructions")).toHaveText(
    "Identify each musical symbol, then choose its name or value.",
  );
});

test("staff-to-letter choices and feedback", async ({ page }, info) => {
  await open(page);
  await capture(page, info, "start");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".answer-choice")).toHaveCount(7);
  await expect(page.locator(".music-staff svg")).toBeVisible();
  const staveBox = await page.locator(".vf-stave").boundingBox();
  expect(staveBox.height, "staff stays enlarged after cropping whitespace").toBeGreaterThan(75);
  await capture(page, info, "question");
  await buttonStates(page, info, ".answer-choice", "answer");
  await buttonStates(page, info, ".practice-play-note", "hear");
  const wrong = page.locator(".answer-choice").filter({ hasNotText: "C" }).first();
  await wrong.click();
  await capture(page, info, "wrong-answer");
  await wrong.click();
  await capture(page, info, "wrong-answer-again");
  await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
  await freeze(page);
  await page.getByRole("button", { name: "C", exact: true }).click();
  await capture(page, info, "correct", null, false);
  await page.clock.runFor(1500);
  await page.getByRole("button", { name: "C", exact: true }).click();
  await page.clock.runFor(1500);
  await page.clock.resume();
  await expect(page.getByRole("heading", { name: "2 questions completed" })).toBeVisible();
  await capture(page, info, "complete");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await capture(page, info, "finished-return-to-start");
});

test("staff to keyboard", async ({ page }, info) => {
  await open(page, { questionTypes: ["keyboard"] });
  await capture(page, info, "start");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await capture(page, info, "question");
  await page.getByRole("button", { name: "D4", exact: true }).click();
  await capture(page, info, "wrong-key");
  await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
  await capture(page, info, "keyboard", page.locator(".music-keyboard"));
  await buttonStates(page, info, ".ReactPiano__Key--natural", "piano-key");
  const keyBox = await page.getByRole("button", { name: "D4", exact: true }).boundingBox();
  await page.mouse.move(keyBox.x + keyBox.width / 2, keyBox.y + keyBox.height - 20);
  await page.mouse.down();
  await capture(page, info, "pressed-key", page.locator(".music-keyboard"));
  await page.mouse.up();
  await freeze(page);
  await page.getByRole("button", { name: /C4, Middle C/ }).tap();
  await capture(page, info, "correct", null, false);
  await page.clock.runFor(700);
  await page.getByRole("button", { name: /C4, Middle C/ }).tap();
  await page.clock.runFor(700);
  await page.clock.resume();
  await capture(page, info, "complete");
});

test("keyboard to letter", async ({ page }, info) => {
  await open(page, { questionTypes: ["keyboard-letters"] });
  await capture(page, info, "start");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".music-staff")).toHaveCount(0);
  await expect(page.locator(".music-keyboard__key-label")).toHaveCount(0);
  await expect(page.locator(".answer-choice")).toHaveCount(7);
  await capture(page, info, "question");
  await capture(page, info, "target-key", page.locator(".music-keyboard__key-target"));
  const wrong = page.locator(".answer-choice").filter({ hasNotText: "C" }).first();
  await wrong.click();
  await capture(page, info, "wrong");
  await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
  await freeze(page);
  await page.getByRole("button", { name: "C", exact: true }).click();
  await capture(page, info, "correct", null, false);
  await page.clock.runFor(700);
  await page.getByRole("button", { name: "C", exact: true }).click();
  await page.clock.runFor(700);
  await page.clock.resume();
  await capture(page, info, "complete");
});

test("flashcards front back retry completion", async ({ page }, info) => {
  await open(page, { mode: "flashcards", clef: "bass" });
  await expect(page.locator(".card-front .music-staff svg")).toBeVisible();
  const frontBox = await page.locator(".card-front").boundingBox();
  const panelBox = await page.locator(".practice-panel").boundingBox();
  expect(frontBox.width, "flashcards use the available tablet width").toBeGreaterThan(panelBox.width * 0.85);
  await capture(page, info, "front");
  await buttonStates(page, info, ".reveal-button", "reveal");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator(".card-back")).toHaveAttribute("aria-hidden", "false");
  await capture(page, info, "answer");
  await buttonStates(page, info, ".again-button", "again");
  await buttonStates(page, info, ".got-it-button", "got-it");
  await page.getByRole("button", { name: /^Again/ }).click();
  await capture(page, info, "retry-front");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: /Got it/ }).click();
  await capture(page, info, "complete");
});

test("notation extremes and fitted keyboard", async ({ page }, info) => {
  for (const clef of ["treble", "bass"]) {
    for (const note of ["C2", "C4", "C6"]) {
      await open(page, { clef, notes: [note] });
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.locator(".music-staff svg")).toBeVisible();
      await capture(page, info, `${clef}-${note}`);
      await capture(page, info, `staff-${clef}-${note}`, page.locator(".music-staff"));
    }
  }
  for (const note of ["C2", "C6"]) {
    await open(page, { questionTypes: ["keyboard"], notes: [note] });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator(".ReactPiano__Key--natural")).toHaveCount(10);
    await expect(page.getByRole("button", { name: /Higher keys|Lower keys/ })).toHaveCount(0);
    const fits = await page.locator(".music-keyboard__keys").evaluate((element) =>
      element.scrollWidth <= element.clientWidth + 1);
    expect(fits).toBe(true);
    await capture(page, info, `fitted-keyboard-${note}`);
  }
});

test("actual defaults and enlarged view", async ({ page }, info) => {
  await open(page, DEFAULT_SETTINGS);
  await capture(page, info, "default-start");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await capture(page, info, "default-question");
  await page.getByRole("button", { name: "Practice setup" }).click();
  await capture(page, info, "setup-pauses-session");
  await page.getByRole("button", { name: "Close practice setup" }).click();
  await page.addStyleTag({ content: "body { zoom: 1.25; }" });
  await capture(page, info, "125-percent-enlargement");
});

test("same piano key works across consecutive questions", async ({ page }, info) => {
  await open(page, { questionTypes: ["keyboard"], roundLength: 5 });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await freeze(page);
  for (let question = 0; question < 5; question++) {
    const key = page.getByRole("button", { name: /C4, Middle C/ });
    await key.focus();
    await key.press("Enter");
    await expect(page.locator(".practice-feedback")).toHaveText("C is correct.");
    await page.clock.runFor(2000);
  }
  await page.clock.resume();
  await expect(page.getByRole("heading", { name: "5 questions completed" })).toBeVisible();
  await capture(page, info, "repeated-key-complete");
});

test("audio failure does not hide the quiz result", async ({ page }, info) => {
  await page.route("**/src/audio.js*", (route) => route.fulfill({
    contentType: "text/javascript",
    body: "export const unlockAudio = async () => {}; export const playNote = async () => { throw new Error('Simulated unavailable audio'); };",
  }));
  await open(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Hear note", exact: true }).click();
  await expect(page.locator(".sound-message")).toContainText("Check your device audio");
  await capture(page, info, "sound-failure");
  await freeze(page);
  await page.getByRole("button", { name: "C", exact: true }).click();
  await expect(page.locator(".practice-feedback")).toHaveText("C is correct.");
  await expect(page.locator(".sound-message")).toContainText("Check your device audio");
  await capture(page, info, "correct-despite-audio-failure", null, false);
});
