import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTES,
  DEFAULT_SETTINGS,
  normalizeSettings,
  buildCards,
  newDeck,
} from "../src/music.js";

test("natural note range includes correct MIDI values for C4 and A4", () => {
  const byId = new Map(NOTES.map((note) => [note.id, note]));
  assert.equal(byId.get("C4")?.midi, 60);
  assert.equal(byId.get("A4")?.midi, 69);
  assert.ok(
    NOTES.every(({ id, letter, octave }) => id === `${letter}${octave}`),
  );
});

test("default settings select treble with the starter notes", () => {
  assert.equal(DEFAULT_SETTINGS.clef, "treble");
  assert.ok(DEFAULT_SETTINGS.notes.includes("C4"));
});

test("settings reject invalid clefs and note ids, falling back safely", () => {
  assert.deepEqual(normalizeSettings({ clef: "alto", notes: ["C4", "H9"] }), {
    clef: "treble",
    notes: ["C4"],
  });
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ clef: "bass", notes: ["H9"] }), {
    clef: "bass",
    notes: [...DEFAULT_SETTINGS.notes],
  });
});

test("card builder matches selected notes and expands both clefs", () => {
  const cards = buildCards({ clef: "both", notes: ["C4", "A4"] });
  assert.deepEqual(
    cards.map(({ id }) => id),
    ["treble-C4", "treble-A4", "bass-C4", "bass-A4"],
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
