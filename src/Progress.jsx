import { useMemo, useRef, useState } from "react";
import { NOTES } from "./music.js";
import { SYMBOLS } from "./symbols.js";
import { practiceModeLabel, progressLabel, readProgress, summarizeProgress } from "./progress.js";
import "./Progress.css";

function ProgressTable({ title, rows, label }) {
  return (
    <section className="parent-progress__section">
      <h3>{title}</h3>
      <table className="table parent-progress__table">
        <thead><tr><th scope="col">{label}</th><th scope="col">First try</th><th scope="col">Progress</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.name}</th>
              <td>{row.firstTry} / {row.attempts}</td>
              <td>{progressLabel(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function Progress({ onPractice, onOpenChange }) {
  const dialog = useRef(null);
  const [entries, setEntries] = useState([]);
  const noteOrder = useMemo(() => new Map(NOTES.map(({ id }, index) => [id, index])), []);
  const symbolNames = useMemo(() => new Map(SYMBOLS.map(({ id, label }) => [id, label])), []);
  const notes = summarizeProgress(entries, "noteId")
    .sort((a, b) => noteOrder.get(a.id) - noteOrder.get(b.id))
    .map((row) => ({ ...row, name: row.id }));
  const modes = summarizeProgress(entries, "mode")
    .map((row) => ({ ...row, name: practiceModeLabel(row.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const weakNotes = notes.filter((row) => progressLabel(row) === "More practice").map(({ id }) => id);
  const symbols = summarizeProgress(entries, "symbolId")
    .sort((a, b) => (symbolNames.get(a.id) ?? a.id).localeCompare(symbolNames.get(b.id) ?? b.id))
    .map((row) => ({ ...row, name: symbolNames.get(row.id) ?? row.id }));
  const weakSymbols = symbols.filter((row) => progressLabel(row) === "More practice").map(({ id }) => id);
  const weakModes = [...new Set(entries
    .filter((entry) => weakNotes.includes(entry.noteId) && progressLabel(entry) === "More practice")
    .map(({ mode }) => mode))];
  const weakSymbolModes = [...new Set(entries
    .filter((entry) => weakSymbols.includes(entry.symbolId) && progressLabel(entry) === "More practice")
    .map(({ mode }) => mode))];

  function open() {
    setEntries(readProgress());
    dialog.current?.showModal();
    onOpenChange(true);
  }

  return (
    <>
      <button type="button" className="btn btn-outline" onClick={open}>Progress</button>
      <dialog ref={dialog} className="setup-panel parent-progress" aria-labelledby="progress-title" onClose={() => onOpenChange(false)}>
        <div className="drawer-heading">
          <h2 id="progress-title">Practice progress</h2>
          <button type="button" className="btn btn-ghost close-drawer" aria-label="Close progress" onClick={() => dialog.current?.close()}>×</button>
        </div>
        <p>First try means the answer was correct before any mistakes. Progress is saved on this device.</p>
        {entries.length === 0 ? (
          <p>Complete a few questions to see progress here.</p>
        ) : (
          <>
            {weakNotes.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => {
                dialog.current?.close();
                onPractice(weakNotes, weakModes);
              }}>
                Practice notes that need more work
              </button>
            )}
            {weakSymbols.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => {
                dialog.current?.close();
                onPractice([], weakSymbolModes, weakSymbols);
              }}>
                Practice symbols that need more work
              </button>
            )}
            <ProgressTable title="By note" rows={notes} label="Note" />
            {symbols.length > 0 && <ProgressTable title="By symbol" rows={symbols} label="Symbol" />}
            <ProgressTable title="By question type" rows={modes} label="Question type" />
          </>
        )}
      </dialog>
    </>
  );
}
