import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCards,
  migrateSettings,
  normalizeSettings,
  noteToMidi,
} from "../src/music.js";
import { buildPracticeCards } from "../src/practice.js";
import {
  completedCount,
  createSession,
  sessionReducer,
} from "../src/session.js";

const settings = (extra) =>
  normalizeSettings({
    mode: "choice",
    questionTypes: ["guided"],
    clef: "treble",
    notes: ["C4", "D4"],
    ...extra,
  });
const begin = (extra) => {
  const config = settings(extra);
  return createSession(buildPracticeCards(config), config, "question");
};
const answer = (state, value) =>
  sessionReducer(state, { type: "answer", answer: value });

test("queued correct inputs score once and cannot skip the next question", () => {
  const initial = begin();
  const correct = answer(initial, "C");
  assert.equal(correct.phase, "correct");
  assert.equal(correct.firstTryCorrect, 1);
  assert.equal(completedCount(correct), 1);
  assert.equal(answer(correct, "C"), correct);
  assert.equal(answer(correct, "D"), correct);
  assert.equal(initial.phase, "question");
  assert.equal(initial.attemptedQuestions, 0);
});

test("mistakes count one attempted question and retain first-try accuracy", () => {
  const wrong = answer(answer(begin(), "E"), "F");
  assert.equal(wrong.attemptedQuestions, 1);
  assert.equal(wrong.wrongCount, 2);
  assert.equal(wrong.selectedAnswer, "F");
  assert.equal(wrong.feedback, "Try once more.");
  const correct = answer(wrong, "C");
  assert.equal(correct.firstTryCorrect, 0);
  assert.equal(correct.attemptedQuestions, 1);
  const next = sessionReducer(correct, { type: "next" });
  assert.equal(next.index, 1);
  assert.equal(next.attempted, false);
  assert.equal(next.wrongCount, 0);
  assert.equal(next.feedback, "");
  assert.equal(answer(next, "D").firstTryCorrect, 1);
});

test("choice practice does not force an answer after repeated mistakes", () => {
  const state = answer(answer(begin({ questionTypes: ["keyboard-letters"] }), "E"), "F");
  assert.equal(state.selectedAnswer, "F");
  assert.equal(state.feedback, "Try once more.");
  assert.equal(state.phase, "question");
});

test("elapsed time continues past a minute without ending the round", () => {
  let state = begin({ questionTypes: ["keyboard"] });
  for (let second = 0; second < 60; second++)
    state = sessionReducer(state, { type: "tick" });
  assert.equal(state.phase, "question");
  assert.equal(state.elapsed, 60);
  state = answer(state, "C4");
  const afterMinute = sessionReducer(state, { type: "tick" });
  assert.equal(afterMinute.phase, "correct");
  assert.equal(afterMinute.elapsed, 61);
  assert.equal(completedCount(afterMinute), 1);
});

test("completion counts every question and replay starts a clean session", () => {
  const first = sessionReducer(answer(begin(), "C"), { type: "next" });
  const complete = sessionReducer(answer(first, "D"), { type: "next" });
  assert.equal(complete.phase, "complete");
  assert.equal(completedCount(complete), 2);
  const config = settings();
  const replay = sessionReducer(complete, {
    type: "start",
    settings: config,
    round: buildCards(config),
  });
  assert.equal(replay.index, 0);
  assert.equal(replay.firstTryCorrect, 0);
  assert.equal(replay.attemptedQuestions, 0);
  assert.equal(replay.elapsed, 0);
});

test("empty rounds cannot start", () => {
  const state = createSession([], settings());
  assert.equal(
    sessionReducer(state, { type: "start", settings: settings(), round: [] })
      .phase,
    "idle",
  );
  assert.equal(answer(state, "C"), state);
});

test("shared pitch parsing handles enharmonic notes and supported bounds", () => {
  assert.equal(noteToMidi("B#3"), 60);
  assert.equal(noteToMidi("Db4"), 61);
  assert.equal(noteToMidi("C2"), 36);
  assert.equal(noteToMidi("C6"), 84);
  assert.equal(noteToMidi("E6"), 88);
  for (const value of ["Cb2", "F6", "H4", "C7", null, {}])
    assert.equal(noteToMidi(value), null);
});

test("legacy starter migration preserves preferences and does not rerun on new settings", () => {
  const old = {
    clef: "treble",
    notes: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
    mode: "letters",
    roundLength: 10,
    choiceCount: 5,
    timed: true,
  };
  const migrated = migrateSettings(old);
  assert.equal(migrated.clef, "both");
  assert.equal(migrated.mode, "choice");
  assert.deepEqual(migrated.questionTypes, ["letters"]);
  assert.equal(migrated.roundLength, 10);
  assert.equal("timed" in migrated, false);
  assert.ok(migrated.notes.includes("C3"));
  assert.equal(
    migrateSettings({ ...old, noCrossingHands: false }).clef,
    "treble",
  );
  assert.deepEqual(migrateSettings({ ...old, notes: ["G4"] }).notes, ["G4"]);
  assert.equal("timed" in normalizeSettings({ mode: "choice", questionTypes: ["guided"], timed: true }), false);
});

test("keyboard prompts deduplicate middle C while staff prompts preserve both clefs", () => {
  const config = { clef: "both", notes: ["B3", "C4", "D4"] };
  assert.equal(buildPracticeCards({ ...config, mode: "choice", questionTypes: ["guided"] }).length, 4);
  assert.equal(
    buildPracticeCards({ ...config, mode: "choice", questionTypes: ["keyboard-letters"] }).length,
    3,
  );
  assert.equal(buildCards({ ...config, noCrossingHands: false }).length, 6);
});

test("a missed question returns after two other questions and is recorded once", () => {
  const config = settings({ notes: ["C4", "D4", "E4", "F4"] });
  const initial = createSession(buildPracticeCards(config), config, "question");
  const wrong = answer(initial, "G");
  const corrected = answer(wrong, "C");
  assert.equal(corrected.round.length, 5);
  assert.equal(corrected.round[3].note.id, "C4");
  assert.equal(corrected.round[3].review, true);
  assert.deepEqual(corrected.outcomes, [{ noteId: "C4", mode: "letters", firstTry: false }]);
});

test("a miss at the end gets a gap using earlier notes when possible", () => {
  const config = settings({ notes: ["C4", "D4", "E4", "F4"] });
  let state = createSession(buildPracticeCards(config), config, "question");
  for (const letter of ["C", "D", "E"]) {
    state = sessionReducer(answer(state, letter), { type: "next" });
  }
  state = answer(answer(state, "G"), "F");
  assert.deepEqual(state.round.slice(4).map((card) => card.note.id), ["E4", "D4", "F4"]);
});

test("a missed review does not make a round repeat indefinitely", () => {
  const config = settings({ notes: ["C4"] });
  let state = createSession(buildPracticeCards(config), config, "question");
  state = answer(answer(state, "D"), "C");
  state = sessionReducer(state, { type: "next" });
  state = answer(answer(state, "D"), "C");
  assert.equal(state.round.length, 2);
  assert.equal(sessionReducer(state, { type: "next" }).phase, "complete");
});
