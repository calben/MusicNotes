import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Staff from "./Staff";
import Keyboard from "./Keyboard";
import {
  buildCards,
  normalizeSettings,
  playNote,
  unlockAudio,
} from "./music.js";
import {
  answerChoices,
  createRound,
  getKeyboardRange,
  isAnswerCorrect,
} from "./practice.js";
import "./Practice.css";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G"];
const PROMPTS = {
  guided: "Tap the letter that names this note.",
  letters: "Choose the note name.",
  keyboard: "Tap the matching piano key.",
};
export default function PracticeSession({ settings, paused = false }) {
  const config = useMemo(() => normalizeSettings(settings), [settings]);
  const settingsKey = JSON.stringify([
    config.clef,
    config.notes,
    config.mode,
    config.roundLength,
    config.choiceCount,
    config.timed,
  ]);
  const cards = useMemo(() => buildCards(config), [settingsKey]);
  const keyboardRange = useMemo(() => getKeyboardRange(cards), [cards]);
  const [round, setRound] = useState(() =>
    createRound(cards, config.roundLength),
  );
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [wrongCount, setWrongCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [attemptedQuestions, setAttemptedQuestions] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [audioError, setAudioError] = useState("");
  const wrongRef = useRef(0);
  const hintedRef = useRef(false);
  const attemptedRef = useRef(false);
  const lockedRef = useRef(false);
  const settingsKeyRef = useRef(settingsKey);

  const card = round[index];
  const choices = useMemo(
    () => answerChoices(card, config.choiceCount, cards),
    [card, index, config.choiceCount, cards],
  );
  const live = phase !== "idle" && phase !== "complete";
  const forcedAnswer = config.mode === "guided" && wrongCount >= 2;
  const hintRevealsTarget = showHint || phase === "correct";

  const resetSession = useCallback(
    (startImmediately = false) => {
      setRound(createRound(cards, config.roundLength));
      setIndex(0);
      setPhase(startImmediately ? "question" : "idle");
      setWrongCount(0);
      wrongRef.current = 0;
      setShowHint(false);
      hintedRef.current = false;
      attemptedRef.current = false;
      lockedRef.current = false;
      setFeedback("");
      setFeedbackKind("");
      setSelectedAnswer("");
      setLastAnswerCorrect(false);
      setCompleted(0);
      setFirstTryCorrect(0);
      setAttemptedQuestions(0);
      setElapsed(0);
      setAudioError("");
      if (startImmediately) {
        setAudioError("");
        unlockAudio().catch(() =>
          setAudioError("Sound could not start. Check your device audio."),
        );
      }
    },
    [cards, config.roundLength],
  );

  useEffect(() => {
    if (settingsKeyRef.current === settingsKey) return;
    settingsKeyRef.current = settingsKey;
    resetSession(false);
  }, [settingsKey, resetSession]);

  useEffect(() => {
    if (!live || paused) return undefined;
    const timer = window.setInterval(
      () => setElapsed((seconds) => seconds + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [live, paused]);

  useEffect(() => {
    if (
      config.mode === "guided" ||
      !config.timed ||
      elapsed < 60 ||
      phase === "idle" ||
      phase === "complete"
    )
      return;
    lockedRef.current = true;
    setFeedback("Time is up.");
    setFeedbackKind("info");
    setPhase("complete");
  }, [config.mode, config.timed, elapsed, phase]);

  const start = useCallback(() => {
    if (paused || !round.length) return;
    resetSession(true);
  }, [paused, resetSession, round.length]);

  const nextCard = useCallback(() => {
    lockedRef.current = false;
    wrongRef.current = 0;
    hintedRef.current = false;
    attemptedRef.current = false;
    setWrongCount(0);
    setShowHint(false);
    setAudioError("");
    setFeedback("");
    setFeedbackKind("");
    setSelectedAnswer("");
    setLastAnswerCorrect(false);
    if (index + 1 >= round.length) {
      setPhase("complete");
      return;
    }
    setIndex((current) => current + 1);
    setPhase("question");
  }, [index, round.length]);

  useEffect(() => {
    if (phase !== "correct" || paused) return undefined;
    const delay = config.mode === "guided" ? 1400 : 600;
    const timer = window.setTimeout(nextCard, delay);
    return () => window.clearTimeout(timer);
  }, [phase, paused, config.mode, nextCard]);

  const recordFirstAnswer = useCallback((correct) => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    setAttemptedQuestions((count) => count + 1);
    if (correct && !hintedRef.current && wrongRef.current === 0) {
      setFirstTryCorrect((count) => count + 1);
    }
  }, []);

  const handleAnswer = useCallback(
    (answer) => {
      if (!card || phase !== "question" || lockedRef.current || paused) return;
      const correct = isAnswerCorrect(card, answer, config.mode);
      setSelectedAnswer(String(answer).toUpperCase());
      setLastAnswerCorrect(correct);
      recordFirstAnswer(correct);
      if (correct) {
        lockedRef.current = true;
        setCompleted((count) => count + 1);
        setFeedback(`${card.note.letter} is correct.`);
        setFeedbackKind("correct");
        setPhase("correct");
        if (config.mode !== "keyboard") {
          playNote(card.note.id).catch(() =>
            setAudioError("Sound could not start. Check your device audio."),
          );
        }
        return;
      }
      const nextWrong = wrongRef.current + 1;
      wrongRef.current = nextWrong;
      setWrongCount(nextWrong);
      if (config.mode === "guided" && nextWrong >= 2) {
        setShowHint(true);
        hintedRef.current = true;
        setSelectedAnswer("");
        setFeedback(`Tap ${card.note.letter} to continue.`);
        setFeedbackKind("wrong");
      } else {
        setFeedback(
          config.mode === "guided"
            ? "Try once more."
            : "Not quite. Try again, or use Hint.",
        );
        setFeedbackKind("wrong");
      }
    },
    [card, config.mode, paused, phase, recordFirstAnswer],
  );

  useEffect(() => {
    if (phase !== "question" || paused || config.mode === "keyboard") {
      return undefined;
    }
    const availableLetters =
      config.mode === "guided"
        ? forcedAnswer
          ? [card?.note?.letter]
          : choices
        : LETTERS;
    const handleLetterKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat)
        return;
      if (document.querySelector("dialog[open]")) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      const letter = event.key.toUpperCase();
      if (!/^[A-G]$/.test(letter) || !availableLetters.includes(letter)) return;
      event.preventDefault();
      handleAnswer(letter);
    };
    window.addEventListener("keydown", handleLetterKey);
    return () => window.removeEventListener("keydown", handleLetterKey);
  }, [
    card?.note?.letter,
    choices,
    config.mode,
    forcedAnswer,
    handleAnswer,
    paused,
    phase,
  ]);

  const giveHint = useCallback(() => {
    if (!card || phase !== "question" || paused) return;
    hintedRef.current = true;
    setShowHint(true);
    const instruction =
      config.mode === "keyboard"
        ? "Tap the highlighted key."
        : `Tap ${card.note.letter}.`;
    setFeedback(instruction);
    setFeedbackKind("info");
  }, [card, config.mode, paused, phase]);

  const playQuestionNote = useCallback(() => {
    if (!card || paused) return;
    playNote(card.note.id).catch(() =>
      setAudioError("Sound could not start. Check your device audio."),
    );
  }, [card, paused]);

  const handleKeyboardPlay = useCallback(
    (noteId) => {
      if (!card || paused) return;
      playNote(noteId).catch(() =>
        setAudioError("Sound could not start. Check your device audio."),
      );
      handleAnswer(noteId);
    },
    [card, handleAnswer, paused],
  );

  const finish = useCallback(() => {
    lockedRef.current = true;
    setFeedback("");
    setPhase("idle");
    setElapsed(0);
  }, []);

  const replay = useCallback(() => resetSession(true), [resetSession]);

  const accuracy = attemptedQuestions
    ? Math.round((firstTryCorrect / attemptedQuestions) * 100)
    : 0;
  const progress = Math.min(completed, round.length);
  const remaining = Math.max(0, 60 - elapsed);

  if (phase === "idle") {
    return (
      <div className={`practice-session mode-${config.mode}`}>
        <div className="practice-start-screen">
          <p className="practice-instructions">{PROMPTS[config.mode]}</p>
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
            {completed} {completed === 1 ? "note" : "notes"} completed
          </h2>
          {config.mode !== "guided" && (
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
            <button type="button" className="btn btn-outline practice-finish" onClick={finish}>
              Finish
            </button>
          </div>
        </div>
      </div>
    );
  }

  const revealTarget = config.mode === "keyboard" && hintRevealsTarget;

  return (
    <div className={`practice-session mode-${config.mode}`}>
      {config.mode !== "guided" && config.timed && (
        <header className="practice-header">
          <span
            className="practice-timer"
            role="timer"
            aria-label={`${remaining} seconds remaining`}
          >
            {remaining}s
          </span>
        </header>
      )}
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
        <section className="practice-question-wrap" aria-label="Current note">
          <span className="badge badge-primary clef-badge">
            {card.clef === "treble" ? "Treble clef" : "Bass clef"}
          </span>
          <Staff note={card.note} clef={card.clef} hiddenLabel compact />
          <h2 className="practice-question">{PROMPTS[config.mode]}</h2>
          {config.mode === "guided" && (
            <div className="practice-choices">
              {choices.map((letter) => (
                <button
                  type="button"
                  key={letter}
                  className={`btn btn-primary btn-lg answer-choice ${selectedAnswer === letter && lastAnswerCorrect ? "correct" : ""} ${selectedAnswer === letter && !lastAnswerCorrect ? "wrong" : ""} ${showHint && letter === card.note.letter ? "highlighted" : ""}`}
                  onClick={() => handleAnswer(letter)}
                  disabled={
                    paused ||
                    phase === "correct" ||
                    (forcedAnswer && letter !== card.note.letter)
                  }
                >
                  {letter}
                  {selectedAnswer === letter && lastAnswerCorrect && (
                    <span className="answer-check" aria-label="Correct">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {config.mode === "letters" && (
            <div className="practice-choices practice-choices--letters">
              {LETTERS.map((letter) => (
                <button
                  type="button"
                  key={letter}
                  className={`btn btn-primary btn-lg answer-choice ${selectedAnswer === letter && lastAnswerCorrect ? "correct" : ""} ${selectedAnswer === letter && !lastAnswerCorrect ? "wrong" : ""} ${showHint && letter === card.note.letter ? "highlighted" : ""}`}
                  onClick={() => handleAnswer(letter)}
                  disabled={paused || phase === "correct"}
                >
                  {letter}
                  {selectedAnswer === letter && lastAnswerCorrect && (
                    <span className="answer-check" aria-label="Correct">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {config.mode === "keyboard" && (
            <div className="practice-keyboard">
              <Keyboard
                note={card.note}
                onPlay={handleKeyboardPlay}
                showLabels
                highlightTarget={revealTarget}
                rangeOverride={keyboardRange}
              />
            </div>
          )}
          <div className="practice-question-actions">
            {config.mode !== "keyboard" && (
              <button
                type="button"
                className="btn btn-outline practice-play-note"
                onClick={playQuestionNote}
                disabled={paused}
              >
                Hear note
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary practice-hint"
              onClick={giveHint}
              disabled={paused || phase === "correct"}
            >
              Hint
            </button>
          </div>
          <p
            className={`practice-feedback ${feedback ? "visible" : ""} ${feedbackKind}`}
            role="status"
            aria-live="polite"
          >
            {feedback || audioError}
          </p>
        </section>
      )}
    </div>
  );
}
