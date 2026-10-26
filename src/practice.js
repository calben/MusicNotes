import { shuffle } from "lodash-es";
import * as Tone from "tone";
import { newDeck, PRACTICE_MODES } from "./music.js";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G"];
export { PRACTICE_MODES };

export function createRound(cards, roundLength = 5) {
  if (!Array.isArray(cards) || cards.length === 0) return [];
  if (roundLength === 0) return newDeck(cards);
  const size = Math.max(1, roundLength);
  const round = [];
  while (round.length < size) {
    const deck = newDeck(cards, round.at(-1)?.id);
    round.push(...deck.slice(0, size - round.length));
  }
  return round;
}

export function answerChoices(card, choiceCount = 2, selectedCards = []) {
  if (!card?.note?.letter) return [];
  const count = choiceCount === 3 ? 3 : 2;
  const correct = card.note.letter.toUpperCase();
  const selectedLetters = [
    ...new Set(
      selectedCards
        .map((item) => item.note?.letter?.toUpperCase())
        .filter((letter) => LETTERS.includes(letter)),
    ),
  ];
  const pool = selectedLetters.filter((letter) => letter !== correct);
  const fill = LETTERS.filter(
    (letter) => letter !== correct && !pool.includes(letter),
  );
  const decoys = [...shuffle(pool), ...shuffle(fill)].slice(0, count - 1);
  return shuffle([correct, ...decoys]);
}

export function getKeyboardRange(cards) {
  const pitches = (cards || [])
    .map((card) => card.note?.midi)
    .filter(Number.isFinite);
  if (!pitches.length) return { first: 36, last: 48 };
  let first = Math.max(36, Math.floor(Math.min(...pitches) / 12) * 12);
  let last = Math.min(84, Math.ceil(Math.max(...pitches) / 12) * 12);
  if (last <= first) {
    if (first + 12 <= 84) last = first + 12;
    else first = Math.max(36, last - 12);
  }
  return { first, last };
}

function noteIdToMidi(noteId) {
  const match = /^([A-G])([#b]?)([2-6])$/.exec(String(noteId || ""));
  if (!match) return null;
  return Tone.Frequency(noteId).toMidi();
}

export function isAnswerCorrect(card, answer, mode = "letters") {
  if (!card?.note) return false;
  if (mode === "keyboard") {
    const midi = typeof answer === "number" ? answer : noteIdToMidi(answer);
    return midi === card.note.midi;
  }
  return String(answer || "").toUpperCase() === card.note.letter.toUpperCase();
}
