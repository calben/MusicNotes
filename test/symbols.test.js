import test from "node:test";
import assert from "node:assert/strict";
import {
  SYMBOLS,
  SYMBOL_CATEGORIES,
  DEFAULT_SYMBOL_IDS,
  buildSymbolCards,
  isSymbolAnswerCorrect,
  normalizeSymbolIds,
  symbolAnswer,
  symbolAnswerChoices,
  symbolAnswerLabel,
} from "../src/symbols.js";

test("symbol catalog covers the requested families and keeps defaults opt-in", () => {
  assert.equal(SYMBOLS.length, 18);
  assert.deepEqual(DEFAULT_SYMBOL_IDS, []);
  assert.deepEqual(SYMBOL_CATEGORIES.map(({ id }) => id), ["notes", "rests", "dynamics", "clefs", "barlines"]);
  assert.deepEqual(normalizeSymbolIds([]), []);
  assert.deepEqual(normalizeSymbolIds(["bass-clef", "unknown", "bass-clef"]), ["bass-clef"]);
  assert.deepEqual(normalizeSymbolIds(undefined), []);
});

test("rhythm symbols report their duration in quarter-note beats in 4/4", () => {
  const expected = {
    "whole-note": 4,
    "half-note": 2,
    "quarter-note": 1,
    "eighth-note": 0.5,
    "whole-rest": 4,
    "half-rest": 2,
    "quarter-rest": 1,
    "paired-eighth-notes": 1,
  };
  const cards = buildSymbolCards(Object.keys(expected));
  assert.equal(cards.length, Object.keys(expected).length);
  for (const card of cards) {
    assert.equal(card.kind, "symbol");
    assert.equal(card.quizMode, "symbol-beats");
    assert.equal(card.symbol.measureBeats, 4);
    assert.equal(card.symbol.beats, expected[card.symbol.id]);
    assert.equal(symbolAnswer(card), expected[card.symbol.id]);
    assert.equal(isSymbolAnswerCorrect(card, expected[card.symbol.id]), true);
    assert.equal(isSymbolAnswerCorrect(card, "wrong"), false);
    const beats = expected[card.symbol.id];
    assert.equal(symbolAnswerLabel(beats, "symbol-beats"), `${beats === 0.5 ? "half" : beats} ${beats === 0.5 || beats === 1 ? "beat" : "beats"}`);
  }
  assert.equal(SYMBOLS.find(({ id }) => id === "paired-eighth-notes").beats, 1);
});

test("non-rhythm symbol cards ask for names and use stable symbol IDs as answers", () => {
  const cards = buildSymbolCards(["pp", "p", "f", "ff", "crescendo", "diminuendo", "treble-clef", "bass-clef", "bar-line", "repeat-sign"]);
  assert.equal(cards.length, 10);
  for (const card of cards) {
    assert.equal(card.quizMode, "symbol-name");
    assert.equal(card.symbol.beats, undefined);
    assert.equal(symbolAnswer(card), card.symbol.id);
    assert.equal(isSymbolAnswerCorrect(card, card.symbol.id), true);
    assert.equal(isSymbolAnswerCorrect(card, card.symbol.label), true);
    assert.equal(symbolAnswerLabel(card.symbol.id), card.symbol.label);
    const choices = symbolAnswerChoices(card, 4);
    assert.equal(choices.length, 4);
    assert.equal(new Set(choices).size, 4);
    assert.ok(choices.includes(card.symbol.id));
    assert.equal(symbolAnswerChoices(card, 5).length, 5);
  }
});

test("beat answer choices stay numeric and include the correct value", () => {
  const [card] = buildSymbolCards(["eighth-note"]);
  const choices = symbolAnswerChoices(card, 4);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices).size, choices.length);
  assert.ok(choices.includes(0.5));
  assert.ok(choices.every((value) => typeof value === "number"));
  assert.equal(symbolAnswerLabel(0.5, "symbol-beats"), "half beat");
});
