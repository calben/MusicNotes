import { useEffect, useMemo, useRef, useState } from "react";
import ReactCardFlipModule from "react-card-flip";
import Staff from "./Staff";
import Keyboard from "./Keyboard";
import PracticeSession from "./PracticeSession";
import {
  DEFAULT_SETTINGS,
  NOTES,
  PRACTICE_MODES,
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
  { id: "both", name: "Both", hint: "Treble + bass" },
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
  const [setupOpen, setSetupOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const questionHeading = useRef(null);
  const answerHeading = useRef(null);
  const setupDialog = useRef(null);
  const card = deck[index];
  const complete = settings.mode === "flashcards" && index >= deck.length;
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
  function openSetup() {
    setDraft(settings);
    setupDialog.current?.showModal();
    setSetupOpen(true);
  }
  function closeSetup() {
    setSetupOpen(false);
    setupDialog.current?.close();
  }
  function closeSetupFromBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      event.currentTarget.close();
  }
  function startPractice() {
    if (draft.mode === "flashcards" && !draft.notes.length) return;
    if (!draft.notes.length) return;
    const normalized = normalizeSettings(draft);
    const safe = {
      ...normalized,
      timed: normalized.mode === "guided" ? false : normalized.timed,
    };
    const cards = buildCards(safe);
    setSettings(safe);
    setDraft(safe);
    setDeck(newDeck(cards));
    setRoundSize(cards.length);
    setIndex(0);
    setMastered(0);
    setFlipped(false);
    setSoundError("");
    setSessionKey((current) => current + 1);
    closeSetup();
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
        <button type="button" className="btn btn-outline settings-button" onClick={openSetup}>
          <span aria-hidden="true">⚙</span> Practice setup
        </button>
      </header>

      <div className="workspace" id="top">
        <dialog
          ref={setupDialog}
          id="practice-setup"
          className="setup-panel"
          aria-labelledby="setup-title"
          onClick={closeSetupFromBackdrop}
          onClose={() => setSetupOpen(false)}
        >
          <div className="drawer-heading">
            <div className="setup-heading">
              <h1 id="setup-title">Practice setup</h1>
            </div>
            <button
              type="button"
              className="btn btn-ghost close-drawer"
              autoFocus
              aria-label="Close practice setup"
              onClick={closeSetup}
            >
              ×
            </button>
          </div>
          <fieldset className="mode-fieldset">
            <legend>Practice mode</legend>
            <div className="mode-grid">
              {PRACTICE_MODES.map((mode) => (
                <button
                  type="button"
                  key={mode.id}
                  className={`btn mode-option ${draft.mode === mode.id ? "btn-primary selected" : "btn-outline"}`}
                  aria-pressed={draft.mode === mode.id}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      mode: mode.id,
                      ...(mode.id === "guided" ? { timed: false } : {}),
                    }))
                  }
                >
                  <span>{mode.label}</span>
                  <small>{mode.description}</small>
                </button>
              ))}
            </div>
          </fieldset>
          {draft.mode !== "flashcards" && (
            <div className="practice-options">
              {draft.mode === "guided" && (
                <fieldset className="option-fieldset">
                  <legend>Answer choices</legend>
                  <div className="segmented-options">
                    {[2, 3].map((choiceCount) => (
                      <button
                        type="button"
                        key={choiceCount}
                        aria-pressed={draft.choiceCount === choiceCount}
                        className={`btn ${draft.choiceCount === choiceCount ? "btn-primary selected" : "btn-outline"}`}
                        onClick={() =>
                          setDraft((current) => ({ ...current, choiceCount }))
                        }
                      >
                        {choiceCount} choices
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <fieldset className="option-fieldset">
                <legend>Round length</legend>
                <div className="segmented-options">
                  {[5, 10, 0].map((length) => (
                    <button
                      type="button"
                      key={length}
                      aria-pressed={draft.roundLength === length}
                      className={`btn ${draft.roundLength === length ? "btn-primary selected" : "btn-outline"}`}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          roundLength: length,
                        }))
                      }
                    >
                      {length === 0 ? "All notes" : `${length} notes`}
                    </button>
                  ))}
                </div>
              </fieldset>
              {draft.mode !== "guided" && (
                <label className="toggle-option">
                  <input
                    className="checkbox checkbox-lg"
                    type="checkbox"
                    checked={Boolean(draft.timed)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        timed: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>60-second challenge</strong>
                    <small>Finish the selected round within 60 seconds.</small>
                  </span>
                </label>
              )}
            </div>
          )}
          <fieldset className="clef-fieldset">
            <legend>Staff clef</legend>
            <div className="clef-options">
              {CLEFS.map(({ id, name, hint }) => (
                <button
                  type="button"
                  key={id}
                  className={`btn clef-option ${draft.clef === id ? "btn-primary selected" : "btn-outline"}`}
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
              className="btn btn-outline"
              type="button"
              onClick={() =>
                choosePreset(["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"])
              }
            >
              Starter
            </button>
            <button
              className="btn btn-outline"
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
              className="btn btn-outline"
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
            <button className="btn btn-outline" type="button" onClick={selectAll}>
              Select all
            </button>
            <button className="btn btn-outline" type="button" onClick={clearSelection}>
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
                      className={`btn pitch-chip ${noteIds.has(note.id) ? "btn-primary chosen" : "btn-outline"}`}
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
            className="btn btn-primary start-button"
            onClick={startPractice}
            disabled={!draft.notes.length}
          >
            Start practice <span aria-hidden="true">→</span>
          </button>
        </dialog>

        <section className="practice-panel" aria-label="Note practice">
          {settings.mode !== "flashcards" ? (
            <PracticeSession
              key={sessionKey}
              settings={settings}
              paused={setupOpen}
            />
          ) : (
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
                    <span
                      style={{ width: `${(mastered / roundSize) * 100}%` }}
                    />
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
                        {card.clef === "bass" && (
                          <div className="card-meta">
                            <span className="badge badge-primary clef-badge">
                              Bass clef
                            </span>
                          </div>
                        )}
                        <div className="staff-frame">
                          <Staff
                            note={card.note}
                            clef={card.clef}
                            hiddenLabel
                          />
                        </div>
                        <h3 ref={questionHeading} tabIndex="-1">
                          What note is this?
                        </h3>
                        <button
                          type="button"
                          className="btn btn-outline hear-button"
                          onClick={() => hear(card.note.id)}
                        >
                          <span aria-hidden="true">♪</span> Hear the note
                        </button>
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
                        className="flashcard card-back"
                        key="back"
                        aria-hidden={!flipped}
                        inert={!flipped ? "" : undefined}
                      >
                        {card.clef === "bass" && (
                          <div className="card-meta">
                            <span className="clef-badge">Bass clef</span>
                          </div>
                        )}
                        <h3
                          className="sr-only"
                          ref={answerHeading}
                          tabIndex="-1"
                        >
                          Answer: {card.note.id}
                        </h3>
                        <div className="answer-note" aria-hidden="true">
                          <span>{card.note.letter}</span>
                          <small>octave {card.note.octave}</small>
                        </div>
                        <Keyboard note={card.note} onPlay={hear} showLabels />
                        <button
                          type="button"
                          className="btn btn-outline hear-button answer-hear"
                          onClick={() => hear(card.note.id)}
                        >
                          <span aria-hidden="true">♪</span> Hear the note
                        </button>
                        <div className="grade-actions">
                          <button
                            type="button"
                            className="btn btn-outline again-button"
                            onClick={retryCurrent}
                          >
                            Again{" "}
                            <span className="grade-hint">come back later</span>
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
                    </ReactCardFlip>
                  </div>
                </>
              ) : null}
              <div className="sound-message" role="status" aria-live="polite">
                {soundError}
              </div>
            </>
          )}
        </section>
      </div>
      <footer className="page-footer">
        <span>Settings saved on this device.</span>
      </footer>
    </main>
  );
}
