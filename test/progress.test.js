import test from "node:test";
import assert from "node:assert/strict";
import { readProgress, saveOutcomes, summarizeProgress, progressLabel } from "../src/progress.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("progress persists first attempts by pitch and question type", () => {
  const storage = memoryStorage();
  saveOutcomes([
    { noteId: "C4", mode: "guided", firstTry: false },
    { noteId: "C4", mode: "guided", firstTry: true },
    { noteId: "C4", mode: "keyboard", firstTry: true },
    { noteId: "D4", mode: "keyboard", firstTry: true },
  ], storage);
  const entries = readProgress(storage);
  const notes = summarizeProgress(entries, "noteId");
  assert.deepEqual(notes.find(({ id }) => id === "C4"), { id: "C4", attempts: 3, firstTry: 2 });
  assert.equal(progressLabel(notes.find(({ id }) => id === "C4")), "More practice");
  assert.deepEqual(summarizeProgress(entries, "mode").find(({ id }) => id === "keyboard"), { id: "keyboard", attempts: 2, firstTry: 2 });
});

test("symbol progress is keyed by symbol and keeps its answer mode", () => {
  const storage = memoryStorage();
  saveOutcomes([
    { symbolId: "quarter-note", mode: "symbol-name", firstTry: true },
    { symbolId: "quarter-note", mode: "symbol-beats", firstTry: false },
    { symbolId: "whole-note", mode: "symbol-name", firstTry: true },
  ], storage);
  const entries = readProgress(storage);
  assert.deepEqual(summarizeProgress(entries, "symbolId").find(({ id }) => id === "quarter-note"), {
    id: "quarter-note", attempts: 2, firstTry: 1,
  });
  assert.equal(summarizeProgress(entries, "mode").find(({ id }) => id === "symbol-beats").attempts, 1);
  assert.equal(entries.some(({ noteId }) => noteId), false);
});

test("invalid symbol outcomes are ignored without discarding legacy note entries", () => {
  const storage = memoryStorage();
  saveOutcomes([
    { noteId: "C4", mode: "guided", firstTry: true },
    { symbolId: "not-a-symbol", mode: "symbol-name", firstTry: true },
    { symbolId: "quarter-note", mode: "guided", firstTry: true },
  ], storage);
  assert.deepEqual(readProgress(storage), [{ noteId: "C4", mode: "guided", attempts: 1, firstTry: 1 }]);
});

test("unavailable and corrupt storage do not break practice", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(readProgress(broken), []);
  assert.doesNotThrow(() => saveOutcomes([{ noteId: "C4", mode: "guided", firstTry: true }], broken));
  assert.deepEqual(readProgress({ getItem: () => "not json" }), []);
});
