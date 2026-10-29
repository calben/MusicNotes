import test from "node:test";
import assert from "node:assert/strict";
import {
  answerChoices,
  buildFlashcardCards,
  buildPracticeCards,
  createRound,
  isAnswerCorrect,
} from "../src/practice.js";
import { buildCards } from "../src/music.js";

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

test("selected question types mix evenly for choice and flashcard formats", () => {
  const settings = {
    mode: "choice",
    clef: "treble",
    notes: ["C4", "D4", "E4"],
    questionTypes: ["guided", "keyboard-letters"],
  };
  const cards = buildPracticeCards(settings);
  assert.deepEqual(
    new Set(cards.map((card) => card.quizMode)),
    new Set(settings.questionTypes),
  );
  const round = createRound(cards, 5);
  const roundTypeCounts = settings.questionTypes.map(
    (type) => round.filter((card) => card.quizMode === type).length,
  );
  assert.ok(Math.max(...roundTypeCounts) - Math.min(...roundTypeCounts) <= 1);
  const allNotes = createRound(cards, 0);
  assert.equal(allNotes.length, cards.length);
  assert.equal(
    allNotes.filter((card) => card.quizMode === "guided").length,
    allNotes.filter((card) => card.quizMode === "keyboard-letters").length,
  );
  const flashcards = buildPracticeCards({ ...settings, mode: "flashcards" });
  assert.deepEqual(new Set(flashcards.map((card) => card.quizMode)), new Set(settings.questionTypes));
  assert.equal(flashcards.length, 6);
});

test("guided and all-letters selections share one equivalent flashcard direction", () => {
  const settings = {
    mode: "flashcards",
    clef: "treble",
    notes: ["C4", "D4"],
    questionTypes: ["guided", "letters", "keyboard"],
  };
  const cards = buildFlashcardCards(settings);
  assert.equal(cards.filter((card) => card.quizMode === "guided").length, 2);
  assert.equal(cards.filter((card) => card.quizMode === "letters").length, 0);
  assert.equal(cards.filter((card) => card.quizMode === "keyboard").length, 2);
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
  const fourChoices = answerChoices(card, 4, selected);
  const fiveChoices = answerChoices(card, 5, selected);

  assert.equal(twoChoices.length, 2);
  assert.equal(threeChoices.length, 3);
  assert.equal(fourChoices.length, 4);
  assert.equal(fiveChoices.length, 5);
  for (const choices of [twoChoices, threeChoices, fourChoices, fiveChoices]) {
    assert.equal(new Set(choices).size, choices.length);
    assert.equal(choices.filter((letter) => letter === "C").length, 1);
    assert.ok(choices.every((letter) => "ABCDEFG".includes(letter)));
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

test("keyboard answers require exact pitch while letter answers ignore octave", () => {
  const c4 = cardFor("C4");

  assert.equal(isAnswerCorrect(c4, "C", "letters"), true);
  assert.equal(isAnswerCorrect(c4, "C5", "keyboard"), false);
  assert.equal(isAnswerCorrect(c4, "C4", "keyboard"), true);
  assert.equal(isAnswerCorrect(c4, c4.note.midi, "keyboard"), true);
});
