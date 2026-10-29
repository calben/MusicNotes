import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTES,
  DEFAULT_SETTINGS,
  normalizeSettings,
  migrateSettings,
  DEFAULT_QUESTION_TYPES,
  buildCards,
  newDeck,
  keyboardRangeForNote,
} from "../src/music.js";

test("natural note range includes correct MIDI values for C4 and A4", () => {
  const byId = new Map(NOTES.map((note) => [note.id, note]));
  assert.equal(byId.get("C4")?.midi, 60);
  assert.equal(byId.get("A4")?.midi, 69);
  assert.ok(
    NOTES.every(({ id, letter, octave }) => id === `${letter}${octave}`),
  );
});

test("every pitch fits a C-to-E keyboard with C, D, E in both octaves", () => {
  for (const note of NOTES) {
    const range = keyboardRangeForNote(note);
    assert.equal(range.last - range.first, 16);
    assert.ok(range.first <= note.midi && range.last >= note.midi);
    assert.ok(range.first >= 36 && range.last <= 88);
  }
  assert.deepEqual(keyboardRangeForNote(NOTES[0]), { first: 36, last: 52 });
  assert.deepEqual(keyboardRangeForNote(NOTES.at(-1)), { first: 72, last: 88 });
});

test("default settings select choice practice and retain the starter notes", () => {
  assert.equal(DEFAULT_SETTINGS.mode, "choice");
  assert.equal(DEFAULT_SETTINGS.roundLength, 5);
  assert.equal(DEFAULT_SETTINGS.choiceCount, 2);
  assert.equal("voice" in DEFAULT_SETTINGS, false);
  assert.equal("autoVoiceDirections" in DEFAULT_SETTINGS, false);
  assert.equal("autoVoiceDirections" in normalizeSettings({ autoVoiceDirections: true }), false);
  assert.equal("timed" in DEFAULT_SETTINGS, false);
  assert.equal(DEFAULT_SETTINGS.clef, "both");
  assert.equal(DEFAULT_SETTINGS.noCrossingHands, true);
  assert.ok(DEFAULT_SETTINGS.notes.includes("C4"));
});

test("old saved settings migrate while preserving clef and selected notes", () => {
  const settings = normalizeSettings({ clef: "bass", notes: ["C3", "G3"] });

  assert.deepEqual(settings, {
    ...DEFAULT_SETTINGS,
    clef: "bass",
    notes: ["C3", "G3"],
  });
});

test("malformed fields safely fall back while valid notes are retained", () => {
  const settings = normalizeSettings({
    clef: "alto",
    notes: ["C4", "H9", "C4"],
    mode: "unknown",
    roundLength: 7,
    choiceCount: 6,
    timed: 1,
  });

  assert.deepEqual(settings, { ...DEFAULT_SETTINGS, notes: ["C4"] });
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.equal("timed" in normalizeSettings({ mode: "choice", timed: true }), false);
  assert.deepEqual(normalizeSettings({ clef: "bass", notes: ["H9"] }), {
    ...DEFAULT_SETTINGS,
    clef: "bass",
  });
});

test("question selections normalize, preserve valid choices, and migrate old saves", () => {
  assert.deepEqual(DEFAULT_SETTINGS.questionTypes, [...DEFAULT_QUESTION_TYPES]);
  assert.deepEqual(
    normalizeSettings({ questionTypes: ["letters", "unknown", "letters"] })
      .questionTypes,
    ["letters"],
  );
  assert.deepEqual(
    normalizeSettings({ questionTypes: [] }).questionTypes,
    [...DEFAULT_QUESTION_TYPES],
  );
  assert.deepEqual(
    migrateSettings({ clef: "bass", notes: ["C3"], mode: "mixed", mixedQuestionTypes: ["letters", "keyboard"] })
      .questionTypes,
    ["letters", "keyboard"],
  );
  const timedLegacy = migrateSettings({ mode: "keyboard", timed: true });
  assert.deepEqual(timedLegacy.questionTypes, ["keyboard"]);
  assert.equal("timed" in timedLegacy, false);
  assert.deepEqual(migrateSettings({ mode: "keyboard", mixedQuestionTypes: ["guided", "letters"] }).questionTypes, ["keyboard"]);
  assert.equal(timedLegacy.mode, "choice");
  assert.equal(migrateSettings({ mode: "flashcards" }).mode, "flashcards");
});

test("card builder keeps pitches on their side of middle C in both clefs", () => {
  const cards = buildCards({ clef: "both", notes: ["B3", "C4", "D4"] });
  assert.deepEqual(
    cards.map(({ id }) => id),
    ["treble-C4", "treble-D4", "bass-B3", "bass-C4"],
  );
  assert.equal(cards[0].note.midi, 60);
  assert.deepEqual(
    [...new Set(cards.map(({ clef }) => clef))],
    ["treble", "bass"],
  );
});

test("new deck keeps every card and avoids repeating the previous first card", () => {
  const cards = buildCards({ clef: "treble", notes: ["C4", "D4", "E4", "F4"] });
  const first = newDeck(cards, cards[0].id);
  assert.equal(first.length, cards.length);
  assert.deepEqual(
    new Set(first.map(({ id }) => id)),
    new Set(cards.map(({ id }) => id)),
  );
  assert.notEqual(first[0].id, cards[0].id);

  const single = newDeck(cards.slice(0, 1), cards[0].id);
  assert.equal(single[0].id, cards[0].id);
});

test("practice range contains 29 natural notes from C2 through C6", () => {
  assert.equal(NOTES.length, 29);
  assert.equal(NOTES[0].id, "C2");
  assert.equal(NOTES.at(-1).id, "C6");
});

test("card builder supports either single clef and removes duplicate selections", () => {
  const selected = { notes: ["C4", "C4", "D4"] };
  const treble = buildCards({ ...selected, clef: "treble" });
  const bass = buildCards({ ...selected, clef: "bass" });

  assert.deepEqual(
    treble.map(({ id }) => id),
    ["treble-C4", "treble-D4"],
  );
  assert.deepEqual(
    bass.map(({ id }) => id),
    ["bass-C4", "bass-D4"],
  );
});
