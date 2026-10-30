import { useEffect, useRef, useState } from "react";
import Staff from "./Staff";
import Keyboard from "./Keyboard";
import { newDeck } from "./music.js";
import { playNote } from "./audio.js";
import { buildPracticeCards } from "./practice.js";
import SymbolNotation from "./SymbolNotation";
import { symbolAnswerLabel } from "./symbols.js";

export default function Flashcards({ settings, onRestart }) {
  const [deck, setDeck] = useState(() => newDeck(buildPracticeCards(settings)));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [soundError, setSoundError] = useState("");
  const questionHeading = useRef(null);
  const answerHeading = useRef(null);
  const card = deck[index];
  const roundSize = deck.length;
  const mastered = index;
  const complete = index >= roundSize;

  useEffect(() => {
    if (index > 0 || flipped)
      (flipped ? answerHeading : questionHeading).current?.focus();
  }, [index, flipped]);

  function advance() {
    setFlipped(false);
    setIndex((current) => current + 1);
  }
  function retryCurrent() {
    setDeck((current) => [
      ...current.slice(0, index),
      ...current.slice(index + 1),
      current[index],
    ]);
    setFlipped(false);
  }
  async function hear(id) {
    setSoundError("");
    try {
      await playNote(id);
    } catch {
      setSoundError(
        "Sound could not start. Check your device audio and try again.",
      );
    }
  }
  function restart() {
    onRestart?.();
    setDeck(newDeck(buildPracticeCards(settings)));
    setIndex(0);
    setFlipped(false);
    setSoundError("");
  }

  return (
    <>
      <div className="session-topline">
        {!complete && (
          <span className="progress-count">
            {mastered}
            <span> / {roundSize} mastered</span>
          </span>
        )}
      </div>
      {complete ? (
        <div className="finish-card" role="status">
          <h2>Practice complete</h2>
          <p>
            {roundSize} {roundSize === 1 ? "card" : "cards"} completed.
          </p>
          <button
            type="button"
            className="btn btn-primary start-button"
            onClick={restart}
          >
            Practice again <span aria-hidden="true">↻</span>
          </button>
        </div>
      ) : card ? (
        <>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Cards mastered"
            aria-valuemin="0"
            aria-valuemax={roundSize}
            aria-valuenow={mastered}
          >
            <span style={{ width: `${(mastered / roundSize) * 100}%` }} />
          </div>
          <div className="card-wrap">
            <div
              key={`${card.id}-${index}`}
              className={`swap swap-flip w-full grid-cols-1 items-start cursor-default ${flipped ? "swap-active" : ""}`}
            >
              <article
                className="flashcard card-front swap-off w-full"
                key="front"
                aria-hidden={flipped}
                inert={flipped ? "" : undefined}
              >
                {card.kind === "symbol" ? (
                  <div className="symbol-card-front"><SymbolNotation symbol={card.symbol} /><p className="symbol-card-question" ref={questionHeading} tabIndex="-1">{card.quizMode === "symbol-beats" ? "How many beats in 4/4?" : card.symbol.category === "dynamics" ? "What does this dynamic mean?" : "What is this symbol called?"}</p></div>
                ) : card.clef === "bass" && (
                  <div className="card-meta">
                    <span className="badge badge-primary clef-badge">
                      Bass clef
                    </span>
                  </div>
                )}
                {card.kind === "symbol" ? null : card.quizMode === "keyboard-letters" ? (
                  <Keyboard note={card.note} onPlay={hear} showLabels={false} highlightTarget />
                ) : (
                  <div className="staff-frame">
                    <Staff note={card.note} clef={card.clef} hiddenLabel />
                  </div>
                )}
                {card.kind !== "symbol" && <h3 ref={questionHeading} tabIndex="-1">
                  {card.quizMode === "keyboard-letters"
                    ? "What letter is this piano key?"
                    : card.quizMode === "keyboard"
                      ? "Which piano key matches this note?"
                      : "What note is this?"}
                </h3>}
                {card.kind !== "symbol" && <button
                  type="button"
                  className="btn btn-outline hear-button"
                  onClick={() => hear(card.note.id)}
                >
                  <span aria-hidden="true">♪</span> Hear the note
                </button>}
                <button
                  type="button"
                  className="btn btn-primary reveal-button"
                  onClick={() => {
                    setFlipped(true);
                    setSoundError("");
                  }}
                >
                  Reveal answer
                </button>
              </article>
              <article
                className="flashcard card-back swap-on w-full"
                key="back"
                aria-hidden={!flipped}
                inert={!flipped ? "" : undefined}
              >
                {card.kind === "symbol" ? null : card.clef === "bass" && (
                  <div className="card-meta">
                    <span className="clef-badge">Bass clef</span>
                  </div>
                )}
                <h3 className="sr-only" ref={answerHeading} tabIndex="-1">
                  Answer: {card.kind === "symbol" ? symbolAnswerLabel(card.quizMode === "symbol-beats" ? card.symbol.beats : card.symbol.id, card.quizMode) : card.note.id}
                </h3>
                {card.kind === "symbol" ? (
                  <div className="symbol-answer">
                    <strong>{symbolAnswerLabel(card.quizMode === "symbol-beats" ? card.symbol.beats : card.symbol.id, card.quizMode)}</strong>
                    {card.quizMode === "symbol-beats" && <small>in a 4/4 time signature</small>}
                    {card.symbol.description && <p>{card.symbol.description}</p>}
                  </div>
                ) : <div className="answer-note" aria-hidden="true">
                  <span>{card.note.letter}</span>
                  <small>octave {card.note.octave}</small>
                </div>}
                {card.kind !== "symbol" && <Keyboard note={card.note} onPlay={hear} showLabels />}
                {card.kind !== "symbol" && <button
                  type="button"
                  className="btn btn-outline hear-button answer-hear"
                  onClick={() => hear(card.note.id)}
                >
                  <span aria-hidden="true">♪</span> Hear the note
                </button>}
                <div className="grade-actions">
                  <button
                    type="button"
                    className="btn btn-outline again-button"
                    onClick={retryCurrent}
                  >
                    Again <span className="grade-hint">come back later</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary got-it-button"
                    onClick={advance}
                  >
                    Got it <span aria-hidden="true">✓</span>
                  </button>
                </div>
              </article>
            </div>
          </div>
        </>
      ) : null}
      <div className="sound-message" role="status" aria-live="polite">
        {soundError}
      </div>
    </>
  );
}
