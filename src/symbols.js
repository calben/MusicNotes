import { shuffle } from "lodash-es";

/**
 * Symbol facts are deliberately kept separate from note and clef settings.
 * `glyph` is a small rendering hint for the UI; the renderer owns the actual
 * VexFlow calls so it can lay symbols out with the rest of the question.
 */
export const SYMBOLS = Object.freeze([
  { id: "whole-note", category: "notes", label: "Whole note", description: "A note held for four beats.", beats: 4, glyph: { kind: "note", duration: "w" } },
  { id: "half-note", category: "notes", label: "Half note", description: "A note held for two beats.", beats: 2, glyph: { kind: "note", duration: "h" } },
  { id: "quarter-note", category: "notes", label: "Quarter note", description: "A note held for one beat.", beats: 1, glyph: { kind: "note", duration: "q" } },
  { id: "eighth-note", category: "notes", label: "Eighth note", description: "A note held for half a beat.", beats: 0.5, glyph: { kind: "note", duration: "8" } },
  { id: "whole-rest", category: "rests", label: "Whole rest", description: "Silence for four beats.", beats: 4, glyph: { kind: "rest", duration: "wr" } },
  { id: "half-rest", category: "rests", label: "Half rest", description: "Silence for two beats.", beats: 2, glyph: { kind: "rest", duration: "hr" } },
  { id: "quarter-rest", category: "rests", label: "Quarter rest", description: "Silence for one beat.", beats: 1, glyph: { kind: "rest", duration: "qr" } },
  { id: "paired-eighth-notes", category: "notes", label: "Two eighth notes", description: "Two notes together, held for one beat total.", beats: 1, glyph: { kind: "paired-notes", duration: "8" } },
  { id: "pp", category: "dynamics", label: "Pianissimo (pp)", description: "Play very softly.", glyph: { kind: "text", text: "pp" } },
  { id: "p", category: "dynamics", label: "Piano (p)", description: "Play softly.", glyph: { kind: "text", text: "p" } },
  { id: "f", category: "dynamics", label: "Forte (f)", description: "Play loudly.", glyph: { kind: "text", text: "f" } },
  { id: "ff", category: "dynamics", label: "Fortissimo (ff)", description: "Play very loudly.", glyph: { kind: "text", text: "ff" } },
  { id: "crescendo", category: "dynamics", label: "Crescendo", description: "Gradually get louder.", glyph: { kind: "hairpin", direction: "crescendo" } },
  { id: "diminuendo", category: "dynamics", label: "Diminuendo", description: "Gradually get softer.", glyph: { kind: "hairpin", direction: "diminuendo" } },
  { id: "treble-clef", category: "clefs", label: "Treble clef", description: "The clef commonly used for higher notes.", glyph: { kind: "clef", clef: "treble" } },
  { id: "bass-clef", category: "clefs", label: "Bass clef", description: "The clef commonly used for lower notes.", glyph: { kind: "clef", clef: "bass" } },
  { id: "bar-line", category: "barlines", label: "Bar line", description: "A line that separates measures.", glyph: { kind: "barline", type: "single" } },
  { id: "repeat-sign", category: "barlines", label: "Repeat sign", description: "Marks music to be played again.", glyph: { kind: "barline", type: "repeat-both" } },
].map((symbol) => Object.freeze({ ...symbol, glyph: Object.freeze(symbol.glyph), measureBeats: symbol.beats == null ? null : 4 })));

export const SYMBOL_CATEGORIES = Object.freeze([
  Object.freeze({ id: "notes", label: "Notes" }),
  Object.freeze({ id: "rests", label: "Rests" }),
  Object.freeze({ id: "dynamics", label: "Dynamics" }),
  Object.freeze({ id: "clefs", label: "Clefs" }),
  Object.freeze({ id: "barlines", label: "Bar lines and repeats" }),
]);

export const DEFAULT_SYMBOL_IDS = Object.freeze([]);
export const SYMBOL_QUESTION_TYPES = Object.freeze(["symbol-name", "symbol-beats"]);

const SYMBOL_BY_ID = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));
const BEAT_CHOICES = Object.freeze([0.5, 1, 2, 3, 4]);

export function normalizeSymbolIds(value) {
  if (!Array.isArray(value)) return [...DEFAULT_SYMBOL_IDS];
  return SYMBOLS.filter(({ id }) => value.includes(id)).map(({ id }) => id);
}

/** Build one card per selected symbol; rhythm symbols ask for their 4/4 beat value. */
export function buildSymbolCards(symbolIds = DEFAULT_SYMBOL_IDS) {
  const ids = normalizeSymbolIds(symbolIds);
  return ids.map((id) => {
    const symbol = SYMBOL_BY_ID.get(id);
    const quizMode = symbol.beats == null ? "symbol-name" : "symbol-beats";
    return { id: `symbol-${id}`, kind: "symbol", symbol, quizMode };
  });
}

export function symbolAnswer(card) {
  if (card?.kind !== "symbol" || !card.symbol) return null;
  return card.quizMode === "symbol-beats" ? card.symbol.beats : card.symbol.id;
}

export function isSymbolAnswerCorrect(card, answer) {
  if (card?.kind !== "symbol" || !card.symbol) return false;
  if (card.quizMode === "symbol-beats") {
    const beats = typeof answer === "number" ? answer : Number(answer);
    return Number.isFinite(beats) && beats === card.symbol.beats;
  }
  const value = String(answer ?? "").trim().toLowerCase();
  return value === card.symbol.id || value === card.symbol.label.toLowerCase();
}

export function symbolAnswerChoices(card, choiceCount = 4) {
  if (card?.kind !== "symbol" || !card.symbol) return [];
  if (card.quizMode === "symbol-beats") {
    const correct = card.symbol.beats;
    const options = shuffle([correct, ...shuffle(BEAT_CHOICES.filter((beats) => beats !== correct)).slice(0, Math.max(1, choiceCount - 1))]);
    return options;
  }
  const candidates = SYMBOLS.filter(({ category, id }) => category === card.symbol.category && id !== card.symbol.id);
  const decoys = shuffle(candidates).slice(0, Math.max(1, choiceCount - 1)).map(({ id }) => id);
  const needed = Math.max(0, choiceCount - 1 - decoys.length);
  const fallback = shuffle(SYMBOLS.filter(({ id }) => id !== card.symbol.id && !decoys.includes(id))).slice(0, needed).map(({ id }) => id);
  return shuffle([card.symbol.id, ...decoys, ...fallback]);
}

export function symbolAnswerLabel(value, mode = "symbol-name") {
  if (mode === "symbol-beats") {
    const beats = Number(value);
    return `${beats} ${beats === 1 ? "beat" : "beats"}`;
  }
  return SYMBOL_BY_ID.get(value)?.label ?? "";
}
