import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MidiNumbers, Piano } from "react-piano";
import "react-piano/dist/styles.css";
import { createPianoInputProps } from "./music";

const midiFor = (note) =>
  MidiNumbers.fromNote(`${note.letter.toLowerCase()}${note.octave}`);

export default function Keyboard({ note, onPlay, showLabels = true }) {
  const containerRef = useRef(null);
  const touchNotes = useRef(new Map());
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
      const midi = range.first + index;
      const attrs = MidiNumbers.getAttributes(midi);
      key.dataset.midi = String(midi);
      key.setAttribute("role", "button");
      key.tabIndex = 0;
      key.classList.toggle("music-keyboard__key-target", midi === targetMidi);
      key.classList.toggle(
        "music-keyboard__key-pressed",
        pressed.includes(midi),
      );
      key.setAttribute(
        "aria-label",
        `${attrs.note}${attrs.note === "C4" ? ", Middle C" : ""}${midi === targetMidi ? ", selected target key" : ""}`,
      );
      key.setAttribute("aria-pressed", String(pressed.includes(midi)));
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
  }, [range, width, targetMidi, showLabels, pressed]);

  const play = useCallback(
    (midi) => {
      setPressed((current) =>
        current.includes(midi) ? current : [...current, midi],
      );
      onPlay?.(MidiNumbers.getAttributes(midi).note);
    },
    [onPlay],
  );
  const stop = useCallback((midi) => {
    setPressed((current) => current.filter((n) => n !== midi));
  }, []);

  const handleTouchStart = useCallback(
    (event) => {
      const keyTouches = Array.from(event.changedTouches, (touch) => {
        const key = touch.target?.closest?.(".ReactPiano__Key");
        return [touch, key ? Number(key.dataset.midi) : null];
      }).filter(([, midi]) => midi != null && Number.isFinite(midi));
      if (!keyTouches.length) return;
      event.preventDefault();
      event.stopPropagation();
      for (const [touch, midi] of keyTouches) {
        touchNotes.current.set(touch.identifier, midi);
        play(midi);
      }
    },
    [play],
  );
  const handleTouchEnd = useCallback(
    (event) => {
      const stopped = Array.from(event.changedTouches, (touch) => {
        const midi = touchNotes.current.get(touch.identifier);
        return [touch.identifier, midi];
      }).filter(([, midi]) => midi != null);
      if (!stopped.length) return;
      event.preventDefault();
      event.stopPropagation();
      for (const [identifier, midi] of stopped) {
        stop(midi);
        touchNotes.current.delete(identifier);
      }
    },
    [stop],
  );

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return undefined;
    const options = { capture: true, passive: false };
    host.addEventListener("touchstart", handleTouchStart, options);
    host.addEventListener("touchend", handleTouchEnd, options);
    host.addEventListener("touchcancel", handleTouchEnd, options);
    return () => {
      host.removeEventListener("touchstart", handleTouchStart, true);
      host.removeEventListener("touchend", handleTouchEnd, true);
      host.removeEventListener("touchcancel", handleTouchEnd, true);
    };
  }, [handleTouchEnd, handleTouchStart]);

  const pianoInputProps = useMemo(
    () => createPianoInputProps(play, stop),
    [play, stop],
  );

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
        {...pianoInputProps}
        width={width}
        renderNoteLabel={({ midiNumber, isAccidental }) => {
          if (isAccidental || !showLabels) return null;
          const attrs = MidiNumbers.getAttributes(midiNumber);
          return (
            <span className="music-keyboard__key-label">{attrs.note}</span>
          );
        }}
      />
      {targetMidi != null && (
        <span className="sr-only">Selected piano key: {note.id}</span>
      )}
    </div>
  );
}
