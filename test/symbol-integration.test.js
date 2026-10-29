import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/music.js";
import { buildPracticeCards, createRound } from "../src/practice.js";
import { createSession, sessionReducer } from "../src/session.js";

test("selected symbols mix with notes and symbol-only settings stay symbol-only", () => {
  const mixed = normalizeSettings({ ...DEFAULT_SETTINGS, notes: ["C4"], symbolIds: ["quarter-rest"] });
  assert.ok(buildPracticeCards(mixed).some((card) => card.note?.id === "C4"));
  assert.ok(buildPracticeCards(mixed).some((card) => card.symbol?.id === "quarter-rest"));
  const symbolsOnly = normalizeSettings({ ...mixed, notes: [] });
  assert.deepEqual(symbolsOnly.notes, []);
  assert.ok(buildPracticeCards(symbolsOnly).every((card) => card.kind === "symbol"));
});

test("symbol answers track first attempts and repeat a missed symbol safely", () => {
  const settings = normalizeSettings({ ...DEFAULT_SETTINGS, notes: [], symbolIds: ["quarter-rest"] });
  const round = createRound(buildPracticeCards(settings), 1);
  let state = createSession(round, settings, "question");
  state = sessionReducer(state, { type: "answer", answer: 2 });
  assert.equal(state.phase, "question");
  assert.deepEqual(state.outcomes, [{ symbolId: "quarter-rest", mode: "symbol-beats", firstTry: false }]);
  state = sessionReducer(state, { type: "answer", answer: 1 });
  assert.equal(state.phase, "correct");
  assert.equal(state.round.length, 2);
  assert.equal(state.round[1].symbol.id, "quarter-rest");
});

test("an all-items mixed round includes each selected card exactly once", () => {
  const cards = buildPracticeCards(normalizeSettings({ ...DEFAULT_SETTINGS, notes: ["C4", "D4", "E4"], symbolIds: ["whole-rest"] }));
  const round = createRound(cards, 0);
  assert.deepEqual(new Set(round.map(({ id }) => id)), new Set(cards.map(({ id }) => id)));
  assert.equal(round.length, cards.length);
});
