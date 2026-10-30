import { NOTES, PRACTICE_MODES } from "./music.js";
import { SYMBOLS } from "./symbols.js";

const STORAGE_KEY = "music-notes-progress-v1";
const noteIds = new Set(NOTES.map(({ id }) => id));
const symbolIds = new Set(SYMBOLS.map(({ id }) => id));
const noteModes = new Set(["guided", "letters", "keyboard", "keyboard-letters"]);
const canonicalMode = (mode) => mode === "guided" ? "letters" : mode;
const symbolModes = new Set(["symbol-name", "symbol-beats"]);

function isValidEntry(entry) {
  const validIdentity = entry?.symbolId != null
    ? symbolIds.has(entry.symbolId) && !entry?.noteId && symbolModes.has(entry?.mode)
    : noteIds.has(entry?.noteId) && noteModes.has(entry?.mode);
  return validIdentity && Number.isSafeInteger(entry.attempts) && entry.attempts > 0 &&
    Number.isSafeInteger(entry.firstTry) && entry.firstTry >= 0 && entry.firstTry <= entry.attempts;
}

export function readProgress(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage)?.getItem(STORAGE_KEY) ?? "null");
    if (saved?.version !== 1 || !Array.isArray(saved.entries)) return [];
    const entries = saved.entries.filter(isValidEntry).map((entry) => ({
      ...entry,
      mode: canonicalMode(entry.mode),
    }));
    const merged = new Map();
    for (const entry of entries) {
      const key = `${entry.symbolId ? `symbol:${entry.symbolId}` : `note:${entry.noteId}`}|${entry.mode}`;
      const existing = merged.get(key);
      if (existing) {
        existing.attempts += entry.attempts;
        existing.firstTry += entry.firstTry;
      } else merged.set(key, { ...entry });
    }
    return [...merged.values()];
  } catch {
    return [];
  }
}

export function addOutcomes(entries, outcomes) {
  const records = new Map(entries.map((entry) => [`${entry.symbolId ? `symbol:${entry.symbolId}` : `note:${entry.noteId}`}|${entry.mode}`, { ...entry }]));
  for (const outcome of outcomes) {
    const isSymbol = outcome?.symbolId != null;
    if (isSymbol ? (!symbolIds.has(outcome.symbolId) || !symbolModes.has(outcome.mode)) : (!noteIds.has(outcome?.noteId) || !noteModes.has(outcome?.mode))) continue;
    const idKey = isSymbol ? `symbol:${outcome.symbolId}` : `note:${outcome.noteId}`;
    const mode = canonicalMode(outcome.mode);
    const key = `${idKey}|${mode}`;
    const record = records.get(key) ?? { ...(isSymbol ? { symbolId: outcome.symbolId } : { noteId: outcome.noteId }), mode, attempts: 0, firstTry: 0 };
    record.attempts += 1;
    record.firstTry += outcome.firstTry ? 1 : 0;
    records.set(key, record);
  }
  return [...records.values()];
}

export function saveOutcomes(outcomes, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target || !outcomes.length) return;
    const entries = addOutcomes(readProgress(target), outcomes);
    target.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
  } catch {
    // Practice remains usable if the browser blocks local storage.
  }
}

export function summarizeProgress(entries, field) {
  const totals = new Map();
  for (const entry of entries) {
    const id = entry[field];
    if (id == null) continue;
    const total = totals.get(id) ?? { id, attempts: 0, firstTry: 0 };
    total.attempts += entry.attempts;
    total.firstTry += entry.firstTry;
    totals.set(id, total);
  }
  return [...totals.values()];
}

export function progressLabel({ attempts, firstTry }) {
  if (firstTry / attempts < 0.8) return "More practice";
  return attempts >= 3 ? "Going well" : "Getting started";
}

export const practiceModeLabel = (mode) => ({
  "symbol-name": "Name the symbol",
  "symbol-beats": "Symbol beats",
}[mode] ?? (mode === "guided" || mode === "letters"
  ? PRACTICE_MODES.find(({ id }) => id === "letters")?.label
  : PRACTICE_MODES.find(({ id }) => id === mode)?.label) ?? mode);
