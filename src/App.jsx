import { useEffect, useMemo, useRef, useState } from "react";
import ReactCardFlipModule from "react-card-flip";
import Staff from "./Staff";
import Keyboard from "./Keyboard";
import {
  DEFAULT_SETTINGS,
  NOTES,
  buildCards,
  newDeck,
  normalizeSettings,
  playNote,
} from "./music";
import "./App.css";

// The package publishes CommonJS `exports.default`; Vite 8 may expose either
// the component or its nested default depending on the optimize path.
const ReactCardFlip = ReactCardFlipModule.default ?? ReactCardFlipModule;

const STORAGE_KEY = "music-notes-settings-v1";
const CLEFS = [
  { id: "treble", name: "Treble", hint: "Higher notes" },
  { id: "bass", name: "Bass", hint: "Lower notes" },
  { id: "both", name: "Both", hint: "Mix them up" },
];

function readSettings() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return normalizeSettings(saved || DEFAULT_SETTINGS);
  } catch {
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

export default function App() {
  const initial = useMemo(readSettings, []);
  const [draft, setDraft] = useState(initial);
  const [settings, setSettings] = useState(initial);
  const [deck, setDeck] = useState(() => newDeck(buildCards(initial)));
  const [index, setIndex] = useState(0);
  const [roundSize, setRoundSize] = useState(() => buildCards(initial).length);
  const [mastered, setMastered] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [soundError, setSoundError] = useState("");
  const questionHeading = useRef(null);
  const answerHeading = useRef(null);
  const practicePanel = useRef(null);
  const card = deck[index];
  const complete = index >= deck.length;
  const noteIds = useMemo(() => new Set(draft.notes), [draft.notes]);
  const octaves = [2, 3, 4, 5, 6];
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* Storage may be disabled. */
    }
  }, [settings]);
  useEffect(() => {
    if (index > 0 || flipped)
      (flipped ? answerHeading : questionHeading).current?.focus();
  }, [index, flipped]);

  function setClef(clef) {
    setDraft((current) => ({ ...current, clef }));
  }
  function toggleNote(id) {
    setDraft((current) => ({
      ...current,
      notes: current.notes.includes(id)
        ? current.notes.filter((n) => n !== id)
        : [...current.notes, id],
    }));
  }
  function choosePreset(notes) {
    setDraft((current) => ({ ...current, notes }));
  }
  function selectAll() {
    setDraft((current) => ({
      ...current,
      notes: NOTES.map((note) => note.id),
    }));
  }
  function clearSelection() {
    setDraft((current) => ({ ...current, notes: [] }));
  }
  function startPractice() {
    if (!draft.notes.length) return;
    const safe = normalizeSettings(draft);
    const cards = buildCards(safe);
    setSettings(safe);
    setDraft(safe);
    setDeck(newDeck(cards));
    setRoundSize(cards.length);
    setIndex(0);
    setMastered(0);
    setFlipped(false);
    setSoundError("");
    if (window.innerWidth < 1000)
      practicePanel.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
  }
  function advance() {
    setFlipped(false);
    setMastered((count) => count + 1);
    setIndex((i) => i + 1);
  }
  function retryCurrent() {
    const retry = deck[index];
    setDeck((current) => [
      ...current.slice(0, index),
      ...current.slice(index + 1),
      retry,
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
    setDeck(newDeck(buildCards(settings)));
    setIndex(0);
    setMastered(0);
    setFlipped(false);
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Music Notes home">
          <span className="brand-mark" aria-hidden="true">
            ♫
          </span>
          <span>
            music<span className="brand-light">notes</span>
          </span>
        </a>
        <p>A little practice. A little more confidence.</p>
      </header>

      <div className="workspace" id="top">
        <aside className="setup-panel" aria-labelledby="setup-title">
          <div className="setup-heading">
            <span className="eyebrow">MAKE IT YOURS</span>
            <h1 id="setup-title">Practice setup</h1>
            <p>Choose the notes you want to get to know.</p>
          </div>
          <fieldset className="clef-fieldset">
            <legend>Staff clef</legend>
            <div className="clef-options">
              {CLEFS.map(({ id, name, hint }) => (
                <button
                  type="button"
                  key={id}
                  className={`clef-option ${draft.clef === id ? "selected" : ""}`}
                  aria-pressed={draft.clef === id}
                  onClick={() => setClef(id)}
                >
                  <span>{name}</span>
                  <small>{hint}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="pitch-heading">
            <div>
              <h2>Choose pitches</h2>
              <span className="pitch-count">{draft.notes.length} selected</span>
            </div>
          </div>
          <div className="preset-row" aria-label="Pitch presets">
            <button
              type="button"
              onClick={() =>
                choosePreset(["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"])
              }
            >
              Starter
            </button>
            <button
              type="button"
              onClick={() =>
                choosePreset(
                  NOTES.filter(
                    (n) =>
                      (n.octave === 4 &&
                        ["E", "F", "G", "A", "B"].includes(n.letter)) ||
                      (n.octave === 5 &&
                        ["C", "D", "E", "F"].includes(n.letter)),
                  ).map((n) => n.id),
                )
              }
            >
              Treble staff
            </button>
            <button
              type="button"
              onClick={() =>
                choosePreset(
                  NOTES.filter(
                    (n) =>
                      (n.octave === 2 && ["G", "A", "B"].includes(n.letter)) ||
                      (n.octave === 3 &&
                        ["C", "D", "E", "F", "G", "A"].includes(n.letter)),
                  ).map((n) => n.id),
                )
              }
            >
              Bass staff
            </button>
          </div>
          <div className="selection-actions">
            <button type="button" onClick={selectAll}>
              Select all
            </button>
            <button type="button" onClick={clearSelection}>
              Clear
            </button>
          </div>
          <div className="pitch-groups" aria-label="Select pitches">
            {octaves.map((octave) => (
              <div className="pitch-row" key={octave}>
                <span className="octave-label">{octave}</span>
                <div className="pitch-buttons">
                  {NOTES.filter((n) => n.octave === octave).map((note) => (
                    <button
                      type="button"
                      key={note.id}
                      className={`pitch-chip ${noteIds.has(note.id) ? "chosen" : ""}`}
                      aria-pressed={noteIds.has(note.id)}
                      aria-label={`${note.id}${noteIds.has(note.id) ? ", selected" : ""}`}
                      onClick={() => toggleNote(note.id)}
                    >
                      {note.letter}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {!draft.notes.length && (
            <p className="form-hint" role="status">
              Select at least one pitch to begin.
            </p>
          )}
          <button
            type="button"
            className="start-button"
            onClick={startPractice}
            disabled={!draft.notes.length}
          >
            Start practice <span aria-hidden="true">→</span>
          </button>
        </aside>

        <section
          className="practice-panel"
          ref={practicePanel}
          aria-label="Note flashcards"
        >
          <div className="session-topline">
            <div>
              <span className="eyebrow">YOUR PRACTICE</span>
              <h2>One note at a time</h2>
              <a className="setup-jump" href="#setup-title">
                Adjust setup ↓
              </a>
            </div>
            {!complete && (
              <span className="progress-count">
                {mastered}
                <span> / {roundSize} mastered</span>
              </span>
            )}
          </div>
          {complete ? (
            <div className="finish-card" role="status">
              <span className="finish-star" aria-hidden="true">
                ✳
              </span>
              <span className="eyebrow">NICE WORK</span>
              <h2>That’s a wrap.</h2>
              <p>
                You marked all {roundSize} {roundSize === 1 ? "card" : "cards"}{" "}
                as Got it.
              </p>
              <button type="button" className="start-button" onClick={restart}>
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
                <ReactCardFlip
                  key={`${card.id}-${index}`}
                  isFlipped={flipped}
                  flipDirection="horizontal"
                  flipSpeedFrontToBack={reducedMotion ? 0 : 0.6}
                  flipSpeedBackToFront={reducedMotion ? 0 : 0.6}
                  containerStyle={{ width: "100%" }}
                >
                  <article
                    className="flashcard card-front"
                    key="front"
                    aria-hidden={flipped}
                    inert={flipped ? "" : undefined}
                  >
                    <div className="card-meta">
                      <span className="clef-badge">
                        {card.clef === "treble" ? "Treble clef" : "Bass clef"}
                      </span>
                      <span className="card-overline">NAME THIS NOTE</span>
                    </div>
                    <div className="staff-frame">
                      <Staff note={card.note} clef={card.clef} hiddenLabel />
                    </div>
                    <h3 ref={questionHeading} tabIndex="-1">
                      What note is this?
                    </h3>
                    <button
                      type="button"
                      className="hear-button"
                      onClick={() => hear(card.note.id)}
                    >
                      <span aria-hidden="true">♪</span> Hear the note
                    </button>
                    <button
                      type="button"
                      className="reveal-button"
                      onClick={() => {
                        setFlipped(true);
                        setSoundError("");
                      }}
                    >
                      Reveal answer
                    </button>
                    <p className="card-footnote">
                      Take a breath and have a guess.
                    </p>
                  </article>
                  <article
                    className="flashcard card-back"
                    key="back"
                    aria-hidden={!flipped}
                    inert={!flipped ? "" : undefined}
                  >
                    <div className="card-meta">
                      <span className="clef-badge">
                        {card.clef === "treble" ? "Treble clef" : "Bass clef"}
                      </span>
                      <span className="card-overline">THE ANSWER</span>
                    </div>
                    <h3 className="sr-only" ref={answerHeading} tabIndex="-1">
                      Answer: {card.note.id}
                    </h3>
                    <div className="answer-note" aria-hidden="true">
                      <span>{card.note.letter}</span>
                      <small>octave {card.note.octave}</small>
                    </div>
                    <p className="answer-caption">
                      That’s <strong>{card.note.id}</strong>.
                    </p>
                    <Keyboard note={card.note} onPlay={hear} showLabels />
                    <button
                      type="button"
                      className="hear-button answer-hear"
                      onClick={() => hear(card.note.id)}
                    >
                      <span aria-hidden="true">♪</span> Hear the note
                    </button>
                    <div className="grade-actions">
                      <button
                        type="button"
                        className="again-button"
                        onClick={retryCurrent}
                      >
                        Again{" "}
                        <span className="grade-hint">come back later</span>
                      </button>
                      <button
                        type="button"
                        className="got-it-button"
                        onClick={advance}
                      >
                        Got it <span aria-hidden="true">✓</span>
                      </button>
                    </div>
                  </article>
                </ReactCardFlip>
              </div>
            </>
          ) : null}
          <div className="sound-message" role="status" aria-live="polite">
            {soundError}
          </div>
        </section>
      </div>
      <footer className="page-footer">
        <span>Small steps make beautiful music.</span>
        <span aria-hidden="true">·</span>
        <span>Your settings stay on this device.</span>
      </footer>
    </main>
  );
}
