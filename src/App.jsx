import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Flashcards from "./Flashcards";
import PracticeSession from "./PracticeSession";
import Progress from "./Progress.jsx";
import musicDragonLogo from "./assets/music-dragon-logo.png";
import dragon1 from "./assets/corner-dragon-1.png";
import dragon2 from "./assets/corner-dragon-2.png";
import dragon3 from "./assets/corner-dragon-3.png";
import dragon4 from "./assets/corner-dragon-4.png";
import {
  DEFAULT_SETTINGS,
  QUESTION_TYPES,
  migrateSettings,
  NOTES,
  NOTE_PRESETS,
  PRACTICE_FORMATS,
  ROUND_LENGTHS,
  normalizeSettings,
} from "./music.js";
import { SYMBOLS, SYMBOL_CATEGORIES } from "./symbols.js";
import SymbolNotation from "./SymbolNotation";
import "./App.css";
import "./map-theme.css";

const STORAGE_KEY = "music-notes-settings-v1";
const DRAGONS = [dragon1, dragon2, dragon3, dragon4];
const DRAGON_COUNT = DRAGONS.length;
const CLEFS = [
  { id: "treble", name: "Treble", hint: "Higher notes" },
  { id: "bass", name: "Bass", hint: "Lower notes" },
  { id: "both", name: "Both", hint: "Treble + bass" },
];
const octaves = [2, 3, 4, 5, 6];
const QUESTION_TYPE_LABELS = {
  letters: "Staff to Letter",
  keyboard: "Piano Keys",
  "keyboard-letters": "Keyboard to Letter",
};

function readSettings() {
  try {
    return migrateSettings(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY)),
    );
  } catch {
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

export default function App() {
  const [settings, setSettings] = useState(readSettings);
  const [dragonIndex, setDragonIndex] = useState(
    () => Math.floor(Math.random() * DRAGON_COUNT) + 1,
  );
  const [draft, setDraft] = useState(settings);
  const [setupOpen, setSetupOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(() => new Set());
  const [sessionKey, setSessionKey] = useState(0);
  const setupDialog = useRef(null);
  const noteIds = useMemo(() => new Set(draft.notes), [draft.notes]);
  const hasNoteCards = draft.notes.length > 0 && draft.questionTypes.length > 0;
  const hasSymbolCards = (draft.symbolIds?.length ?? 0) > 0;
  const canStartPractice = hasNoteCards || hasSymbolCards;
  const chooseAnotherDragon = useCallback(() => {
    const offset = 1 + Math.floor(Math.random() * (DRAGON_COUNT - 1));
    setDragonIndex((current) => ((current - 1 + offset) % DRAGON_COUNT) + 1);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* Storage may be disabled. */
    }
  }, [settings]);

  function setClef(clef) {
    setDraft((current) => ({ ...current, clef }));
  }
  function setNoCrossingHands(noCrossingHands) {
    setDraft((current) => ({ ...current, noCrossingHands }));
  }
  function toggleQuestionType(type) {
    setDraft((current) => {
      const selected = current.questionTypes.includes(type);
      return {
        ...current,
        questionTypes: selected
          ? current.questionTypes.filter((item) => item !== type)
          : [...current.questionTypes, type],
      };
    });
  }
  function toggleNote(id) {
    setDraft((current) => ({
      ...current,
      notes: current.notes.includes(id)
        ? current.notes.filter((note) => note !== id)
        : [...current.notes, id],
    }));
  }
  function choosePreset(notes) {
    setDraft((current) => ({ ...current, notes: [...notes] }));
  }
  function selectAll() {
    choosePreset(NOTES.map(({ id }) => id));
  }
  function clearSelection() {
    choosePreset([]);
  }
  function openSetup() {
    setDraft(settings);
    setupDialog.current?.showModal();
    setSetupOpen(true);
  }
  function practiceWeakNotes(notes, modes, symbolIds = []) {
    const noteModes = modes.filter((mode) => QUESTION_TYPES.includes(mode));
    setDraft({
      ...settings,
      notes,
      symbolIds,
      mode: settings.mode,
      questionTypes: noteModes.length ? noteModes : settings.questionTypes,
    });
    setupDialog.current?.showModal();
    setSetupOpen(true);
  }
  function closeSetup() {
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
    ) {
      event.currentTarget.close();
    }
  }
  function startPractice() {
    if (!canStartPractice) return;
    const safe = normalizeSettings(draft);
    if (safe.mode === "flashcards") chooseAnotherDragon();
    setSettings(safe);
    setDraft(safe);
    setSessionKey((current) => current + 1);
    closeSetup();
  }
  function toggleSymbol(id) {
    setDraft((current) => ({
      ...current,
      symbolIds: (current.symbolIds ?? []).includes(id)
        ? current.symbolIds.filter((symbolId) => symbolId !== id)
        : [...(current.symbolIds ?? []), id],
    }));
  }
  function setCategoryExpanded(id, expanded) {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function setCategorySymbols(categoryId, selected) {
    const ids = SYMBOLS.filter((symbol) => symbol.category === categoryId).map(({ id }) => id);
    setDraft((current) => ({
      ...current,
      symbolIds: selected
        ? [...new Set([...(current.symbolIds ?? []), ...ids])]
        : (current.symbolIds ?? []).filter((id) => !ids.includes(id)),
    }));
  }
  function setOctaveNotes(octave, selected) {
    const ids = NOTES.filter((note) => note.octave === octave).map(({ id }) => id);
    setDraft((current) => ({
      ...current,
      notes: selected
        ? [...new Set([...current.notes, ...ids])]
        : current.notes.filter((id) => !ids.includes(id)),
    }));
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Music Notes home">
          <img className="brand-logo" src={musicDragonLogo} alt="" />
          <span>
            music<span className="brand-light">notes</span>
          </span>
        </a>
        <div className="header-actions">
          <Progress onPractice={practiceWeakNotes} onOpenChange={setProgressOpen} />
          <button
            type="button"
            className="btn btn-outline settings-button"
            onClick={openSetup}
          >
            <span aria-hidden="true">⚙</span> Practice setup
          </button>
        </div>
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
              {PRACTICE_FORMATS.map((mode) => (
                <button
                  type="button"
                  key={mode.id}
                  className={`btn mode-option ${draft.mode === mode.id ? "btn-primary" : "btn-outline"}`}
                  aria-pressed={draft.mode === mode.id}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      mode: mode.id,
                    }))
                  }
                >
                  <span>{mode.label}</span>
                  <small>{mode.description}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="option-fieldset question-type-fieldset">
            <legend>Question types</legend>
            <div className="segmented-options">
              {QUESTION_TYPES.map((type) => (
                <button
                  type="button"
                  key={type}
                  aria-pressed={draft.questionTypes.includes(type)}
                  className={`btn ${draft.questionTypes.includes(type) ? "btn-primary" : "btn-outline"}`}
                  onClick={() => toggleQuestionType(type)}
                >
                  {QUESTION_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="option-fieldset symbol-selection">
            <legend>Musical symbols <span className="pitch-count">{draft.symbolIds?.length ?? 0} selected</span></legend>
            <p className="symbol-selection-hint">Add symbols to mix them into practice and flashcards.</p>
            {SYMBOL_CATEGORIES.map((category) => {
              const categorySymbols = SYMBOLS.filter((symbol) => symbol.category === category.id);
              const expanded = expandedCategories.has(`symbol-${category.id}`);
              const selectedCount = categorySymbols.filter(({ id }) => (draft.symbolIds ?? []).includes(id)).length;
              return <section className="symbol-category" key={category.id}>
                <div className="category-heading">
                  <button type="button" className="category-toggle" aria-expanded={expanded} onClick={() => setCategoryExpanded(`symbol-${category.id}`, !expanded)}>
                    <span className="category-chevron" aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                    <span>{category.label}</span>
                    <span className="category-count">{selectedCount}/{categorySymbols.length}</span>
                  </button>
                  <div className="category-actions" role="group" aria-label={`${category.label} selection`}>
                    <button type="button" className="btn btn-outline" aria-label={`Select all ${category.label}`} onClick={() => setCategorySymbols(category.id, true)} disabled={selectedCount === categorySymbols.length}>Select all</button>
                    <button type="button" className="btn btn-outline" aria-label={`Deselect all ${category.label}`} onClick={() => setCategorySymbols(category.id, false)} disabled={selectedCount === 0}>Deselect all</button>
                  </div>
                </div>
                {expanded && <div className="symbol-picks">
                  {categorySymbols.map((symbol) => {
                    const selected = (draft.symbolIds ?? []).includes(symbol.id);
                    return (
                      <button type="button" key={symbol.id} className={`btn symbol-pick ${selected ? "btn-primary" : "btn-outline"}`} aria-pressed={selected} onClick={() => toggleSymbol(symbol.id)}>
                        <SymbolNotation symbol={symbol} compact />
                        <span>{symbol.label}</span>
                      </button>
                    );
                  })}
                </div>}
              </section>;
            })}
          </fieldset>
          {draft.mode === "choice" && (
            <div className="practice-options">
              <fieldset className="option-fieldset">
                <legend>Round length</legend>
                <div className="segmented-options">
                  {ROUND_LENGTHS.map((length) => (
                    <button
                      type="button"
                      key={length}
                      aria-pressed={draft.roundLength === length}
                      className={`btn ${draft.roundLength === length ? "btn-primary" : "btn-outline"}`}
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
            </div>
          )}
          <fieldset className="clef-fieldset">
            <legend>Staff clef</legend>
            <div className="clef-options">
              {CLEFS.map(({ id, name, hint }) => (
                <button
                  type="button"
                  key={id}
                  className={`btn clef-option ${draft.clef === id ? "btn-primary" : "btn-outline"}`}
                  aria-pressed={draft.clef === id}
                  onClick={() => setClef(id)}
                >
                  <span>{name}</span>
                  <small>{hint}</small>
                </button>
              ))}
            </div>
          </fieldset>
          {draft.clef === "both" && (
            <label className="toggle-option">
              <input
                className="checkbox checkbox-lg"
                type="checkbox"
                checked={draft.noCrossingHands}
                onChange={(event) => setNoCrossingHands(event.target.checked)}
              />
              <span>
                <strong>No crossing hands</strong>
                <small>Bass up to C4; treble from C4 and higher.</small>
              </span>
            </label>
          )}
          <div className="pitch-heading">
            <div>
              <h2>Choose pitches</h2>
              <span className="pitch-count">{draft.notes.length} selected</span>
            </div>
          </div>
          <div className="preset-row" role="group" aria-label="Pitch presets">
            {NOTE_PRESETS.map(({ label, notes }) => (
              <button
                key={label}
                className="btn btn-outline"
                type="button"
                onClick={() => choosePreset(notes)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="selection-actions">
            <button
              className="btn btn-outline"
              type="button"
              onClick={selectAll}
            >
              Select all
            </button>
            <button
              className="btn btn-outline"
              type="button"
              onClick={clearSelection}
            >
              Clear
            </button>
          </div>
          <div className="pitch-groups" role="group" aria-label="Select pitches">
            {octaves.map((octave) => {
              const octaveNotes = NOTES.filter((note) => note.octave === octave);
              const expanded = expandedCategories.has(`octave-${octave}`);
              const selectedCount = octaveNotes.filter(({ id }) => noteIds.has(id)).length;
              return <section className="pitch-category" key={octave}>
                <div className="category-heading">
                  <button type="button" className="category-toggle" aria-expanded={expanded} onClick={() => setCategoryExpanded(`octave-${octave}`, !expanded)}>
                    <span className="category-chevron" aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                    <span>Octave {octave}</span>
                    <span className="category-count">{selectedCount}/{octaveNotes.length}</span>
                  </button>
                  <div className="category-actions" role="group" aria-label={`Octave ${octave} pitch selection`}>
                    <button type="button" className="btn btn-outline" aria-label={`Select all pitches in octave ${octave}`} onClick={() => setOctaveNotes(octave, true)} disabled={selectedCount === octaveNotes.length}>Select all</button>
                    <button type="button" className="btn btn-outline" aria-label={`Deselect all pitches in octave ${octave}`} onClick={() => setOctaveNotes(octave, false)} disabled={selectedCount === 0}>Deselect all</button>
                  </div>
                </div>
                {expanded && <div className="pitch-row">
                <span className="octave-label" aria-hidden="true">{octave}</span>
                <div className="pitch-buttons">
                  {NOTES.filter((n) => n.octave === octave).map((note) => (
                    <button
                      type="button"
                      key={note.id}
                      className={`btn pitch-chip ${noteIds.has(note.id) ? "btn-primary" : "btn-outline"}`}
                      aria-pressed={noteIds.has(note.id)}
                      aria-label={`${note.id}${noteIds.has(note.id) ? ", selected" : ""}`}
                      onClick={() => toggleNote(note.id)}
                    >
                      {note.letter}
                    </button>
                  ))}
                </div>
              </div>}
              </section>;
            })}
          </div>
          {!canStartPractice && (
            <p className="form-hint" role="status">
              {draft.notes.length > 0 && draft.questionTypes.length === 0
                ? "Select a note question type or add a musical symbol."
                : "Select a pitch or musical symbol to begin."}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg start-button"
            onClick={startPractice}
            disabled={!canStartPractice}
          >
            Start practice <span aria-hidden="true">→</span>
          </button>
        </dialog>

        <section
          className={`practice-panel dragon-${dragonIndex}`}
          style={{ "--dragon-image": `url("${DRAGONS[dragonIndex - 1]}")` }}
          aria-label="Note practice"
        >
          {settings.mode === "flashcards" ? (
            <Flashcards key={sessionKey} settings={settings} onRestart={chooseAnotherDragon} />
          ) : (
            <PracticeSession
              key={sessionKey}
              settings={settings}
              paused={setupOpen || progressOpen}
              onStart={chooseAnotherDragon}
            />
          )}
        </section>
      </div>
    </main>
  );
}
