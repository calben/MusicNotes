import { shuffle } from "lodash-es";
import { buildSymbolCards, isSymbolAnswerCorrect, symbolAnswerChoices } from "./symbols.js";
import {
  buildCards,
  CHOICE_COUNTS,
  LETTERS,
  newDeck,
  noteToMidi,
  normalizeSettings,
} from "./music.js";

export function buildPracticeCards(settings) {
  const safe = normalizeSettings(settings);
  const cards = buildCards(safe);
  const directions = safe.questionTypes;
  const keyboardCards = [...new Map(cards.map((card) => [card.note.id, card])).values()];
  const noteCards = directions.flatMap((quizMode) =>
    (quizMode === "keyboard-letters" ? keyboardCards : cards).map((card) => ({
      ...card,
      id: `${card.id}-${quizMode}`,
      quizMode,
    })),
  );
  return [...noteCards, ...buildSymbolCards(safe.symbolIds)];
}

export function buildFlashcardCards(settings) {
  const cards = buildPracticeCards(settings);
  const types = new Set(settings.questionTypes ?? []);
  if (!types.has("guided") || !types.has("letters")) return cards;
  return cards.filter((card) => card.quizMode !== "letters");
}

export function createRound(cards, roundLength = 5) {
  if (!Array.isArray(cards) || cards.length === 0) return [];
  if (roundLength === 0) return newDeck(cards);
  if (cards.some((card) => card.quizMode)) {
    const size = Math.max(1, roundLength);
    const modes = shuffle([...new Set(cards.map((card) => card.quizMode))]);
    const decks = new Map(
      modes.map((mode) => [mode, newDeck(cards.filter((card) => card.quizMode === mode))]),
    );
    const positions = new Map(modes.map((mode) => [mode, 0]));
    return Array.from({ length: size }, (_, index) => {
      const mode = modes[index % modes.length];
      const deck = decks.get(mode);
      let position = positions.get(mode);
      if (position >= deck.length) {
        decks.set(mode, newDeck(deck));
        position = 0;
      }
      positions.set(mode, position + 1);
      return decks.get(mode)[position];
    });
  }
  const size = Math.max(1, roundLength);
  const round = [];
  while (round.length < size) {
    const deck = newDeck(cards, round.at(-1)?.id);
    round.push(...deck.slice(0, size - round.length));
  }
  return round;
}

export function answerChoices(card, choiceCount = 2, selectedCards = []) {
  if (card?.kind === "symbol") return symbolAnswerChoices(card, choiceCount);
  if (!card?.note?.letter) return [];
  const count = CHOICE_COUNTS.includes(choiceCount) ? choiceCount : 2;
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

export function isAnswerCorrect(card, answer, mode = "letters") {
  if (card?.kind === "symbol") return isSymbolAnswerCorrect(card, answer);
  if (!card?.note) return false;
  mode = card.quizMode ?? mode;
  if (mode === "keyboard") {
    const midi = typeof answer === "number" ? answer : noteToMidi(answer);
    return midi === card.note.midi;
  }
  return String(answer || "").toUpperCase() === card.note.letter.toUpperCase();
}
