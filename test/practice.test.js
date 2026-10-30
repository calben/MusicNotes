import test from "node:test";
import assert from "node:assert/strict";
import {
  answerChoices,
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

test("musical symbols can be practiced without note question types", () => {
  const settings = {
    mode: "choice",
    notes: [],
    questionTypes: [],
    symbolIds: ["quarter-note"],
  };
  const cards = buildPracticeCards(settings);

  assert.equal(cards.length, 1);
  assert.equal(cards[0].kind, "symbol");
  assert.equal(cards[0].symbol.id, "quarter-note");
});

test("selected question types mix evenly for choice and flashcard formats", () => {
  const settings = {
    mode: "choice",
    clef: "treble",
    notes: ["C4", "D4", "E4"],
    questionTypes: ["letters", "keyboard-letters"],
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
    allNotes.filter((card) => card.quizMode === "letters").length,
    allNotes.filter((card) => card.quizMode === "keyboard-letters").length,
  );
  const flashcards = buildPracticeCards({ ...settings, mode: "flashcards" });
  assert.deepEqual(new Set(flashcards.map((card) => card.quizMode)), new Set(settings.questionTypes));
  assert.equal(flashcards.length, 6);
});

test("legacy guided and all-letter settings migrate to one flashcard direction", () => {
  const settings = {
    mode: "flashcards",
    clef: "treble",
    notes: ["C4", "D4"],
    questionTypes: ["guided", "letters", "keyboard"],
  };
  const cards = buildPracticeCards(settings);
  assert.equal(cards.filter((card) => card.quizMode === "letters").length, 2);
  assert.equal(cards.filter((card) => card.quizMode === "keyboard").length, 2);
});

test("single-note rounds repeat that note to the requested length", () => {
  const card = cardFor("C4");
  const round = createRound([card], 5);

  assert.equal(round.length, 5);
  assert.ok(round.every((item) => item.id === card.id));
});

test("staff-to-letter questions always offer A through G", () => {
  const card = cardFor("C4");
  const choices = answerChoices(card);
  assert.deepEqual(choices, ["A", "B", "C", "D", "E", "F", "G"]);
  assert.equal(choices.length, 7);
});

test("letter choices stay complete when the selected pool is too small", () => {
  const card = cardFor("C4");
  const choices = answerChoices(card);

  assert.equal(choices.length, 7);
  assert.equal(new Set(choices).size, 7);
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
