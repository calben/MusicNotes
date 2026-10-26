import test from "node:test";
import assert from "node:assert/strict";
import {
  answerChoices,
  createRound,
  getKeyboardRange,
  isAnswerCorrect,
} from "../src/practice.js";
import { NOTES, buildCards } from "../src/music.js";

const cardFor = (noteId) => buildCards({ clef: "treble", notes: [noteId] })[0];

test("rounds are exact length and cycle a short selected pool", () => {
  const cards = buildCards({ clef: "treble", notes: ["C4", "D4"] });
  const round = createRound(cards, 5);

  assert.equal(round.length, 5);
  assert.ok(
    round.every((card) => cards.some((selected) => selected.id === card.id)),
  );
  assert.ok(
    round.every(
      (card, index) => index === 0 || card.id !== round[index - 1].id,
    ),
  );
});

test("all-notes round contains the selected deck exactly once", () => {
  const cards = buildCards({ clef: "bass", notes: ["C3", "E3", "G3"] });
  const round = createRound(cards, 0);

  assert.deepEqual(
    new Set(round.map((card) => card.id)),
    new Set(cards.map((card) => card.id)),
  );
  assert.equal(round.length, cards.length);
});

test("round builder handles an empty deck", () => {
  assert.deepEqual(createRound([], 5), []);
  assert.deepEqual(createRound(null, 0), []);
});

test("single-note rounds repeat that note to the requested length", () => {
  const card = cardFor("C4");
  const round = createRound([card], 5);

  assert.equal(round.length, 5);
  assert.ok(round.every((item) => item.id === card.id));
});

test("guided choices include one correct letter and no duplicates", () => {
  const card = cardFor("C4");
  const selected = buildCards({ clef: "treble", notes: ["C4", "D4", "E4"] });
  const twoChoices = answerChoices(card, 2, selected);
  const threeChoices = answerChoices(card, 3, selected);

  assert.equal(twoChoices.length, 2);
  assert.equal(threeChoices.length, 3);
  for (const choices of [twoChoices, threeChoices]) {
    assert.equal(new Set(choices).size, choices.length);
    assert.equal(choices.filter((letter) => letter === "C").length, 1);
    assert.ok(choices.every((letter) => ["C", "D", "E"].includes(letter)));
  }
});

test("guided choices safely fill from natural letters when the selected pool is too small", () => {
  const card = cardFor("C4");
  const choices = answerChoices(card, 3, [card]);

  assert.equal(choices.length, 3);
  assert.equal(new Set(choices).size, 3);
  assert.ok(choices.includes("C"));
  assert.ok(choices.every((letter) => "ABCDEFG".includes(letter)));
});

test("keyboard range covers selected pitches and expands a single pitch to an octave", () => {
  const cards = buildCards({ clef: "treble", notes: ["D4", "B4"] });
  const range = getKeyboardRange(cards);
  assert.ok(
    cards.every(
      (card) => card.note.midi >= range.first && card.note.midi <= range.last,
    ),
  );

  const onePitch = getKeyboardRange([cardFor("C6")]);
  assert.deepEqual(onePitch, { first: 72, last: 84 });
});

test("keyboard answers require exact pitch while letter answers ignore octave", () => {
  const c4 = cardFor("C4");

  assert.equal(isAnswerCorrect(c4, "C", "letters"), true);
  assert.equal(isAnswerCorrect(c4, "C5", "keyboard"), false);
  assert.equal(isAnswerCorrect(c4, "C4", "keyboard"), true);
  assert.equal(isAnswerCorrect(c4, c4.note.midi, "keyboard"), true);
});

test("keyboard range respects the supported MIDI bounds", () => {
  const cards = buildCards({ clef: "treble", notes: ["C2", "C6"] });
  const { first, last } = getKeyboardRange(cards);

  assert.ok(first >= 36);
  assert.ok(last <= 84);
  assert.ok(
    cards.every((card) => card.note.midi >= first && card.note.midi <= last),
  );
  assert.equal(NOTES[0].midi, 36);
  assert.equal(NOTES.at(-1).midi, 84);
});
