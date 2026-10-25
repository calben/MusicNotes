import { shuffle } from "lodash-es";
import * as Tone from "tone";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

export const NOTES = Array.from({ length: 5 }, (_, octaveIndex) => {
  const octave = octaveIndex + 2;
  return LETTERS.map((letter) => {
    const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter];
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

export const DEFAULT_SETTINGS = Object.freeze({
  clef: "treble",
  notes: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
});

export function normalizeSettings(value) {
  const allowedClefs = ["treble", "bass", "both"];
  const clef = allowedClefs.includes(value?.clef)
    ? value.clef
    : DEFAULT_SETTINGS.clef;
  const notes = Array.isArray(value?.notes)
    ? [...new Set(value.notes.filter((id) => NOTE_BY_ID.has(id)))]
    : [];
  return {
    clef,
    notes: notes.length ? notes : [...DEFAULT_SETTINGS.notes],
  };
}

export function buildCards(settings) {
  const safe = normalizeSettings(settings);
  const clefs = safe.clef === "both" ? ["treble", "bass"] : [safe.clef];
  return clefs.flatMap((clef) =>
    safe.notes.map((id) => ({
      id: `${clef}-${id}`,
      note: NOTE_BY_ID.get(id),
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

let synthPromise;
export async function playNote(noteId) {
  const match = /^([A-G])([#b]?)([2-6])$/.exec(noteId || "");
  if (!match) throw new Error(`Unknown note: ${noteId}`);
  const [, letter, accidental, octaveText] = match;
  const octave = Number(octaveText);
  const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi =
    (octave + 1) * 12 +
    semitones[letter] +
    (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  if (midi < 36 || midi > 84) throw new Error(`Unknown note: ${noteId}`);
  // Invoke start synchronously in the input handler before the first await; this
  // preserves the user gesture on mobile browsers such as iOS Safari.
  const startPromise = Tone.start();
  if (!synthPromise) {
    synthPromise = Promise.resolve()
      .then(() =>
        new Tone.Synth({
          oscillator: { type: "triangle" },
          envelope: { attack: 0.015, decay: 0.18, sustain: 0.22, release: 0.8 },
          volume: -8,
        }).toDestination(),
      )
      .catch((error) => {
        synthPromise = undefined;
        throw error;
      });
  }
  await startPromise;
  const synth = await synthPromise;
  synth.triggerAttackRelease(
    Tone.Frequency(midi, "midi").toFrequency(),
    "8n",
    Tone.now() + 0.01,
  );
}
