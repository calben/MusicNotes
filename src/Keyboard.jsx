import { useEffect, useMemo, useRef, useState } from "react";
import { MidiNumbers, Piano } from "react-piano";
import "react-piano/dist/styles.css";

const midiFor = (note) =>
  MidiNumbers.fromNote(`${note.letter.toLowerCase()}${note.octave}`);

export default function Keyboard({ note, onPlay, showLabels = true }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(320);
  const [pressed, setPressed] = useState([]);
  const targetMidi = note ? midiFor(note) : null;
  const range = useMemo(() => {
    if (!targetMidi)
      return {
        first: MidiNumbers.fromNote("c4"),
        last: MidiNumbers.fromNote("c5"),
      };
    const targetOctave = note.octave;
    // One octave keeps the keys large enough to tap on a landscape tablet.
    const firstOctave = Math.max(2, Math.min(5, targetOctave));
    const first = MidiNumbers.fromNote(`c${firstOctave}`);
    return { first, last: first + 12 };
  }, [targetMidi, note?.octave]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return undefined;
    const measure = () =>
      setWidth(Math.max(250, Math.floor(host.clientWidth || 320)));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const keys = containerRef.current?.querySelectorAll(".ReactPiano__Key");
    if (!keys) return undefined;
    keys.forEach((key, index) => {
      const style = key.classList.contains("ReactPiano__Key--accidental");
      const midi = range.first + index;
      const attrs = MidiNumbers.getAttributes(midi);
      key.setAttribute("role", "button");
      key.tabIndex = 0;
      key.setAttribute(
        "aria-label",
        `${attrs.note}${attrs.note === "C4" ? ", Middle C" : ""}${midi === targetMidi ? ", selected target key" : ""}`,
      );
      key.setAttribute(
        "aria-pressed",
        String(key.classList.contains("ReactPiano__Key--active")),
      );
      key.dataset.accidental = String(style);
      const down = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        play(midi);
      };
      const up = (event) => {
        if (event.key === "Enter" || event.key === " ") stop(midi);
      };
      key.addEventListener("keydown", down);
      key.addEventListener("keyup", up);
      key._musicKeyCleanup = () => {
        key.removeEventListener("keydown", down);
        key.removeEventListener("keyup", up);
      };
    });
    return () => keys.forEach((key) => key._musicKeyCleanup?.());
  }, [range, width, targetMidi, showLabels]);

  const play = (midi) => {
    setPressed([midi]);
    const name = MidiNumbers.getAttributes(midi).note.replace(
      /^([a-g])([#]?)(-?\d+)$/i,
      (_, l, sharp, octave) => `${l.toUpperCase()}${sharp}${octave}`,
    );
    onPlay?.(name);
  };
  const stop = (midi) =>
    setPressed((current) => current.filter((n) => n !== midi));

  return (
    <div
      className="music-keyboard"
      ref={containerRef}
      aria-label="Piano keyboard"
    >
      {targetMidi != null && (
        <span className="music-keyboard__target" aria-live="polite">
          {showLabels
            ? `Target key: ${note.id}${note.id === "C4" ? " · Middle C" : ""}`
            : "Target key highlighted"}
        </span>
      )}
      <Piano
        noteRange={range}
        playNote={play}
        stopNote={stop}
        width={width}
        renderNoteLabel={({ midiNumber, isAccidental }) => {
          if (isAccidental || !showLabels) return null;
          const attrs = MidiNumbers.getAttributes(midiNumber);
          return (
            <span className="music-keyboard__key-label">{attrs.note}</span>
          );
        }}
        activeNotes={
          targetMidi == null ? pressed : [...new Set([...pressed, targetMidi])]
        }
      />
      {targetMidi != null && (
        <span className="sr-only">Selected piano key: {note.id}</span>
      )}
    </div>
  );
}
