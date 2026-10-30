import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import Staff from "./Staff";
import SymbolNotation from "./SymbolNotation";
import { SYMBOLS, symbolAnswerLabel } from "./symbols.js";
import Keyboard from "./Keyboard";
import {
  isChoiceMode,
  LETTERS,
  normalizeSettings,
  PRACTICE_MODES,
} from "./music.js";
import { playNote, unlockAudio } from "./audio.js";
import {
  answerChoices,
  buildPracticeCards,
  createRound,
  isAnswerCorrect,
} from "./practice.js";
import { completedCount, createSession, sessionReducer } from "./session.js";
import { saveOutcomes } from "./progress.js";
import "./Practice.css";

function LetterChoices({ letters, state, paused, onAnswer, card }) {
  return (
    <div
      className={`practice-choices ${state.mode === "letters" ? "practice-choices--letters" : ""} ${card?.kind === "symbol" ? "practice-choices--symbols" : ""}`}
    >
      {letters.map((letter) => {
        const selected = String(state.selectedAnswer).toUpperCase() === String(letter).toUpperCase();
        const correct = selected && state.phase === "correct";
        const variant = correct
          ? "btn-success"
          : selected
            ? "btn-error"
            : "btn-primary";
        const blocked = paused || state.phase === "correct";
        if (correct) {
          return (
            <span key={letter} className="btn btn-lg answer-choice btn-success">
              {card?.kind === "symbol" ? (
                card.quizMode === "symbol-name" && card.symbol.category === "dynamics"
                  ? (SYMBOLS.find(({ id }) => id === letter)?.description ?? symbolAnswerLabel(letter, card.quizMode))
                  : symbolAnswerLabel(letter, card.quizMode)
              ) : letter}
              <span className="answer-check" aria-hidden="true">
                ✓
              </span>
            </span>
          );
        }
        return (
          <button
            type="button"
            key={letter}
            className={`btn btn-lg answer-choice ${variant}`}
            onClick={() => onAnswer(letter)}
            disabled={blocked}
          >
            {card?.kind === "symbol" ? (
              card.quizMode === "symbol-name" && card.symbol.category === "dynamics"
                ? (SYMBOLS.find(({ id }) => id === letter)?.description ?? symbolAnswerLabel(letter, card.quizMode))
                : symbolAnswerLabel(letter, card.quizMode)
            ) : letter}
          </button>
        );
      })}
    </div>
  );
}

// App remounts this component when a parent applies a new configuration.
export default function PracticeSession({ settings, paused = false, onStart }) {
  const config = useMemo(() => normalizeSettings(settings), [settings]);
  const cards = useMemo(() => buildPracticeCards(config), [config]);
  const [state, dispatch] = useReducer(sessionReducer, null, () =>
    createSession(createRound(cards, config.roundLength), config),
  );
  const savedOutcomeCount = useRef(0);
  const [audioError, setAudioError] = useState("");
  const {
    round,
    index,
    phase,
    feedback,
    feedbackKind,
    firstTryCorrect,
    attemptedQuestions,
    elapsed,
  } = state;
  const card = round[index];
  const quizMode = card?.quizMode ?? config.mode;
  const prompt = card?.kind === "symbol"
    ? quizMode === "symbol-beats"
      ? "How many beats does this symbol receive in 4/4?"
      : card.symbol.category === "dynamics"
        ? "What does this dynamic mean?"
        : "What is this symbol called?"
    :
    PRACTICE_MODES.find(({ id }) => id === quizMode)?.prompt ??
    "Follow the prompt and answer the question.";
  const hasNoteCards = cards.some((item) => item.kind !== "symbol");
  const hasSymbolCards = cards.some((item) => item.kind === "symbol");
  const startInstruction = hasNoteCards && hasSymbolCards
    ? "Identify each note or musical symbol, then answer the question."
    : hasSymbolCards
      ? "Identify each musical symbol, then choose its name or value."
      : "Read each staff note or piano key, then answer the question.";
  const choices = useMemo(
    () => answerChoices(card),
    [card, index],
  );
  const choiceMode = isChoiceMode(quizMode);
  const live = phase === "question" || phase === "correct";

  const hear = useCallback((noteId) => {
    setAudioError("");
    playNote(noteId).catch(() =>
      setAudioError("Sound could not start. Check your device audio."),
    );
  }, []);

  useEffect(() => {
    const newOutcomes = state.outcomes.slice(savedOutcomeCount.current);
    if (newOutcomes.length) saveOutcomes(newOutcomes);
    savedOutcomeCount.current = state.outcomes.length;
  }, [state.outcomes]);

  useEffect(() => {
    if (!live || paused) return;
    const timer = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(timer);
  }, [live, paused]);

  useEffect(() => {
    if (phase !== "correct" || paused) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "next" }),
      600,
    );
    return () => window.clearTimeout(timer);
  }, [phase, paused, quizMode]);

  const start = () => {
    if (paused || !cards.length) return;
    onStart?.();
    setAudioError("");
    savedOutcomeCount.current = 0;
    const nextRound = createRound(cards, config.roundLength);
    unlockAudio().catch(() =>
      setAudioError("Sound could not start. Check your device audio."),
    );
    dispatch({
      type: "start",
      round: nextRound,
      settings: config,
    });
  };
  const handleAnswer = useCallback(
    (answer) => {
      if (paused || phase !== "question") return;
      if (isAnswerCorrect(card, answer, quizMode)) {
        if (card.kind !== "symbol" && quizMode !== "keyboard") hear(card.note.id);
      }
      dispatch({ type: "answer", answer });
    },
    [paused, phase, card, quizMode, hear],
  );
  const playQuestionNote = () => {
    if (!paused && card) hear(card.note.id);
  };
  const handleKeyboardPreview = useCallback(
    (noteId) => {
      if (!paused && phase === "question") hear(noteId);
    },
    [paused, phase, hear],
  );
  const handleKeyboardPlay = (noteId) => {
    if (paused || phase !== "question") return;
    hear(noteId);
    handleAnswer(noteId);
  };
  const finish = () => dispatch({ type: "finish" });
  const replay = start;

  useEffect(() => {
    if (phase !== "question" || paused || quizMode === "keyboard" || card?.kind === "symbol") return;
    const available = choiceMode ? choices : LETTERS;
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat)
        return;
      if (document.querySelector("dialog[open]")) return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          "input, textarea, select, [contenteditable='true']",
        )
      )
        return;
      const letter = event.key.toUpperCase();
      if (!available.includes(letter)) return;
      event.preventDefault();
      handleAnswer(letter);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    phase,
    paused,
    quizMode,
    choiceMode,
    card,
    choices,
    handleAnswer,
  ]);

  const completed = completedCount(state);
  const accuracy = attemptedQuestions
    ? Math.round((firstTryCorrect / attemptedQuestions) * 100)
    : 0;
  const progress = completed;

  if (phase === "idle") {
    return (
      <div className={`practice-session mode-${config.mode}`}>
        <div className="practice-start-screen">
          <p className="practice-instructions">{startInstruction}</p>
          <button
            type="button"
            className="btn btn-primary btn-lg practice-start"
            onClick={start}
            disabled={paused || !round.length}
          >
            Play
          </button>
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    const timeText = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
    return (
      <div className={`practice-session mode-${config.mode}`}>
        <div className="practice-complete" role="status">
          <h2>
            {completed} {completed === 1 ? "question" : "questions"} completed
          </h2>
          {config.mode === "choice" && (
            <p className="practice-summary">
              First-try accuracy: {accuracy}% ({firstTryCorrect} of{" "}
              {attemptedQuestions} attempted). Time: {timeText}.
            </p>
          )}
          <div className="practice-actions-row">
            <button
              type="button"
              className="btn btn-primary practice-start"
              onClick={replay}
              disabled={paused}
            >
              Play again
            </button>
            <button
              type="button"
              className="btn btn-outline practice-finish"
              onClick={finish}
            >
              Finish
            </button>
          </div>
        </div>
      </div>
    );
  }

  const revealTarget = quizMode === "keyboard" && phase === "correct";

  return (
    <div className={`practice-session mode-${config.mode}`}>
      <div
        className="practice-progress"
        role="progressbar"
        aria-label="Practice progress"
        aria-valuemin="0"
        aria-valuemax={round.length}
        aria-valuenow={progress}
      >
        <div className="progress progress-primary practice-progress__bar">
          <span style={{ width: `${(progress / round.length) * 100}%` }} />
        </div>
        {round.length <= 10 && (
          <div className="practice-progress__dots" aria-hidden="true">
            {round.map((item, dotIndex) => (
              <span
                key={`${item.id}-${dotIndex}`}
                className={`practice-progress__dot ${dotIndex < progress ? "completed" : dotIndex === index ? "current" : ""}`}
              />
            ))}
          </div>
        )}
        <span className="practice-progress__count">
          {Math.min(index + 1, round.length)} / {round.length}
        </span>
      </div>
      {card && (
        <section className="practice-question-wrap" aria-label={card.kind === "symbol" ? "Current musical symbol" : "Current note"} data-quiz-mode={quizMode}>
          <div className="practice-prompt-slot">
            <h2 className="practice-question">{prompt}</h2>
          </div>
          <div className="practice-stimulus-slot">
          {card.kind === "symbol" ? (
            <SymbolNotation symbol={card.symbol} />
          ) : quizMode === "keyboard-letters" ? (
            <div className="practice-keyboard">
              <Keyboard
                note={card.note}
                onPlay={handleKeyboardPreview}
                showLabels={false}
                highlightTarget
              />
            </div>
          ) : (
            <div className="practice-notation">
              {card.clef === "bass" && (
                <span className="badge badge-primary clef-badge">
                  Bass clef
                </span>
              )}
              <Staff note={card.note} clef={card.clef} hiddenLabel compact />
            </div>
          )}
          </div>
          <div className="practice-answer-slot">
          {(choiceMode || card.kind === "symbol") && (
            <LetterChoices
              letters={choices}
            state={{ ...state, mode: quizMode }}
              paused={paused}
              onAnswer={handleAnswer}
              card={card}
            />
          )}
          </div>
          <div className="practice-interaction-slot">
          {quizMode === "keyboard" && (
            <div className="practice-keyboard">
              <Keyboard
                note={card.note}
                onPlay={handleKeyboardPlay}
                showLabels
                highlightTarget={revealTarget}
              />
            </div>
          )}
          </div>
          {card.kind !== "symbol" && quizMode !== "keyboard" && quizMode !== "keyboard-letters" && (
            <div className="practice-question-actions">
              <button
                type="button"
                className="btn btn-outline practice-play-note"
                onClick={playQuestionNote}
                disabled={paused}
              >
                Hear note
              </button>
            </div>
          )}
          <p
            className={`practice-feedback ${feedback ? "visible" : ""} ${feedbackKind === "correct" ? "text-success" : feedbackKind === "wrong" ? "text-error" : ""}`}
            role="status"
            aria-live="polite"
          >
            {feedback}
          </p>
          {audioError && (
            <p className="sound-message" role="status">
              {audioError}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
