import { shuffle } from "lodash-es";
import { normalizeSymbolIds } from "./symbols.js";

const PITCH_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const LETTERS = Object.freeze(["A", "B", "C", "D", "E", "F", "G"]);
export const CHOICE_COUNTS = Object.freeze([2, 3, 4, 5]);
export const ROUND_LENGTHS = Object.freeze([5, 10, 0]);
export const QUESTION_TYPES = Object.freeze([
  "guided",
  "letters",
  "keyboard",
  "keyboard-letters",
]);
export const DEFAULT_QUESTION_TYPES = Object.freeze(["guided"]);
const LEGACY_MIXED_DEFAULT_TYPES = Object.freeze([
  "guided",
  "keyboard",
  "keyboard-letters",
]);

export const NOTES = Array.from({ length: 5 }, (_, octaveIndex) => {
  const octave = octaveIndex + 2;
  return PITCH_LETTERS.map((letter) => {
    const semitone = SEMITONES[letter];
    return {
      id: `${letter}${octave}`,
      letter,
      octave,
      midi: (octave + 1) * 12 + semitone,
    };
  });
})
  .flat()
  .filter((note) => note.midi <= 84);

const NOTE_BY_ID = new Map(NOTES.map((note) => [note.id, note]));

export function noteToMidi(noteId) {
  const match = /^([A-G])([#b]?)([2-6])$/.exec(String(noteId ?? ""));
  if (!match) return null;
  const [, letter, accidental, octave] = match;
  const midi =
    (Number(octave) + 1) * 12 +
    SEMITONES[letter] +
    (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  return midi >= 36 && midi <= 88 ? midi : null;
}

export function noteIdsInRange(first, last) {
  const low = noteToMidi(first);
  const high = noteToMidi(last);
  if (low == null || high == null) return [];
  return NOTES.filter(({ midi }) => midi >= low && midi <= high).map(
    ({ id }) => id,
  );
}

/** Repeat C, D, and E at both ends while keeping the target in view. */
export function keyboardRangeForNote(note) {
  const octave = Math.max(2, Math.min(5, note?.octave ?? 4));
  const first = (octave + 1) * 12;
  return { first, last: first + 16 };
}

export const isChoiceMode = (mode) =>
  mode === "choice" || mode === "guided" || mode === "keyboard-letters";
export const PRACTICE_FORMATS = [
  { id: "choice", label: "Choice", description: "Answer each question." },
  { id: "flashcards", label: "Flashcards", description: "Reveal each answer and check yourself." },
];
export const PRACTICE_MODES = [
  {
    id: "guided",
    label: "Guided letters",
    description: "Start with a small set of choices.",
    prompt: "Tap the letter that names this note.",
  },
  {
    id: "letters",
    label: "All letters",
    description: "Name each note from A to G.",
    prompt: "Choose the note name.",
  },
  {
    id: "keyboard",
    label: "Piano keys",
    description: "Find the exact pitch on a piano.",
    prompt: "Tap the matching piano key.",
  },
  {
    id: "keyboard-letters",
    label: "Keyboard to letter",
    description: "Name the note shown by a piano key.",
    prompt: "Tap the letter for the highlighted piano key.",
  },
];

export const DEFAULT_SETTINGS = Object.freeze({
  clef: "both",
  notes: Object.freeze(noteIdsInRange("C3", "C5")),
  noCrossingHands: true,
  mode: "choice",
  questionTypes: DEFAULT_QUESTION_TYPES,
  symbolIds: Object.freeze([]),
  roundLength: 5,
  choiceCount: 2,
});

export function normalizeSettings(value) {
  const allowedClefs = ["treble", "bass", "both"];
  const clef = allowedClefs.includes(value?.clef)
    ? value.clef
    : DEFAULT_SETTINGS.clef;
  const notes = Array.isArray(value?.notes)
    ? [...new Set(value.notes.filter((id) => NOTE_BY_ID.has(id)))]
    : [];
  const mode = ["choice", "flashcards"].includes(value?.mode)
    ? value.mode
    : DEFAULT_SETTINGS.mode;
  const symbolIds = normalizeSymbolIds(value?.symbolIds);
  return {
    clef,
    notes: notes.length || (Array.isArray(value?.notes) && symbolIds.length)
      ? notes : [...DEFAULT_SETTINGS.notes],
    noCrossingHands:
      typeof value?.noCrossingHands === "boolean"
        ? value.noCrossingHands
        : DEFAULT_SETTINGS.noCrossingHands,
    mode,
    questionTypes: normalizeQuestionTypes(value?.questionTypes ?? value?.mixedQuestionTypes),
    symbolIds,
    roundLength: ROUND_LENGTHS.includes(value?.roundLength)
      ? value.roundLength
      : DEFAULT_SETTINGS.roundLength,
    choiceCount: CHOICE_COUNTS.includes(value?.choiceCount)
      ? value.choiceCount
      : DEFAULT_SETTINGS.choiceCount,
  };
}

export function normalizeQuestionTypes(value) {
  if (!Array.isArray(value)) return [...DEFAULT_QUESTION_TYPES];
  const selected = QUESTION_TYPES.filter((type) => value.includes(type));
  return selected.length ? selected : [...DEFAULT_QUESTION_TYPES];
}

export const NOTE_PRESETS = [
  { label: "Starter", notes: DEFAULT_SETTINGS.notes },
  { label: "Treble staff", notes: noteIdsInRange("E4", "F5") },
  { label: "Bass staff", notes: noteIdsInRange("G2", "A3") },
];

export function migrateSettings(saved) {
  const previousNotes = noteIdsInRange("C4", "C5");
  const oldStarter =
    saved?.noCrossingHands === undefined &&
    saved?.clef === "treble" &&
    Array.isArray(saved.notes) &&
    saved.notes.length === previousNotes.length &&
    previousNotes.every((id) => saved.notes.includes(id));
  const legacyMode = saved?.mode;
  const questionTypes = Array.isArray(saved?.questionTypes)
    ? saved.questionTypes
    : QUESTION_TYPES.includes(legacyMode)
      ? [legacyMode]
      : Array.isArray(saved?.mixedQuestionTypes)
        ? saved.mixedQuestionTypes
        : legacyMode === "mixed"
          ? LEGACY_MIXED_DEFAULT_TYPES
          : undefined;
  const mode = legacyMode === "flashcards" ? "flashcards" : "choice";
  return normalizeSettings({
    ...saved,
    ...(oldStarter ? { clef: DEFAULT_SETTINGS.clef, notes: DEFAULT_SETTINGS.notes, noCrossingHands: true } : {}),
    mode,
    questionTypes,
  });
}

export function buildCards(settings) {
  const safe = normalizeSettings(settings);
  const clefs = safe.clef === "both" ? ["treble", "bass"] : [safe.clef];
  return clefs.flatMap((clef) =>
    safe.notes
      .map((id) => NOTE_BY_ID.get(id))
      .filter(
        (note) =>
          !safe.noCrossingHands ||
          safe.clef !== "both" ||
          (clef === "treble" ? note.midi >= 60 : note.midi <= 60),
      )
      .map((note) => ({
        id: `${clef}-${note.id}`,
        note,
        clef,
      })),
  );
}

export function newDeck(cards, previousId) {
  const deck = shuffle(cards);
  if (deck.length > 1 && deck[0]?.id === previousId) {
    const swapIndex = deck.findIndex((card) => card.id !== previousId);
    if (swapIndex > 0) [deck[0], deck[swapIndex]] = [deck[swapIndex], deck[0]];
  }
  return deck;
}

const noop = () => {};

/**
 * Keep piano input events independent from programmatic active-note state.
 * react-piano gates playNote on activeNotes changes, but onPlayNoteInput runs
 * for every gesture, including an already-active key.
 */
export function createPianoInputProps(onPlay, onStop) {
  return {
    playNote: noop,
    stopNote: noop,
    onPlayNoteInput: onPlay,
    onStopNoteInput: onStop,
  };
}
