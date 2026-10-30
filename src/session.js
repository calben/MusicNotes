import { isAnswerCorrect } from "./practice.js";
import { symbolAnswer, symbolAnswerLabel } from "./symbols.js";

const questionState = {
  wrongCount: 0,
  attempted: false,
  selectedAnswer: "",
  feedback: "",
  feedbackKind: "",
};

export function createSession(round, settings, phase = "idle") {
  return {
    ...questionState,
    round,
    mode: settings.mode,
    index: 0,
    phase,
    firstTryCorrect: 0,
    attemptedQuestions: 0,
    outcomes: [],
    elapsed: 0,
  };
}

export const completedCount = (state) =>
  Math.min(
    state.index + (state.phase === "correct" ? 1 : 0),
    state.round.length,
  );

/** Pure transitions: repeated input and timer races are resolved in one place. */
export function sessionReducer(state, action) {
  const card = state.round[state.index];
  switch (action.type) {
    case "start":
      return createSession(
        action.round,
        action.settings,
        action.round.length ? "question" : "idle",
      );
    case "answer": {
      if (state.phase !== "question" || !card) return state;
      const mode = card.quizMode ?? state.mode;
      const correct = isAnswerCorrect(card, action.answer, mode);
      const wrongCount = state.wrongCount + (correct ? 0 : 1);
      const retryAt = Math.min(state.index + 3, state.round.length);
      const gapNeeded = Math.max(0, 2 - (state.round.length - state.index - 1));
      const gapCards = state.round.slice(0, state.index).reverse()
        .filter((item) => (item.kind === "symbol" ? item.symbol.id : item.note.id) !==
          (card.kind === "symbol" ? card.symbol.id : card.note.id) && !item.spacing)
        .slice(0, gapNeeded)
        .map((item) => ({ ...item, spacing: true }));
      const round = correct && wrongCount > 0 && !card.review
        ? [
            ...state.round.slice(0, retryAt),
            ...gapCards,
            { ...card, review: true },
            ...state.round.slice(retryAt),
          ]
        : state.round;
      return {
        ...state,
        round,
        outcomes: state.attempted
          ? state.outcomes
          : [
              ...state.outcomes,
              {
                ...(card.kind === "symbol" ? { symbolId: card.symbol.id } : { noteId: card.note.id }),
                mode,
                firstTry: correct,
              },
            ],
        attempted: true,
        attemptedQuestions:
          state.attemptedQuestions + (state.attempted ? 0 : 1),
        firstTryCorrect:
          state.firstTryCorrect +
          (correct && !state.attempted ? 1 : 0),
        phase: correct ? "correct" : "question",
        wrongCount,
        selectedAnswer: String(action.answer).toUpperCase(),
        feedbackKind: correct ? "correct" : "wrong",
        feedback: correct
          ? `${card.kind === "symbol" ? symbolAnswerLabel(symbolAnswer(card), mode) : card.note.letter} is correct.`
          : "Try once more.",
      };
    }
    case "next": {
      if (state.phase !== "correct") return state;
      const index = state.index + 1;
      return {
        ...state,
        ...questionState,
        index,
        phase: index < state.round.length ? "question" : "complete",
      };
    }
    case "tick": {
      if (state.phase !== "question" && state.phase !== "correct") return state;
      return { ...state, elapsed: state.elapsed + 1 };
    }
    case "finish":
      return { ...state, phase: "idle", elapsed: 0, feedback: "" };
    default:
      return state;
  }
}
