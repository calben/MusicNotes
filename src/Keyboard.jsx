import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ControlledPiano, MidiNumbers } from "react-piano";
import "react-piano/dist/styles.css";
import { createPianoInputProps, keyboardRangeForNote } from "./music";

const KEY_HEIGHT = 224;
const NATURAL_KEYS = 10; // C D E F G A B C D E.

function midiFromTarget(target) {
  const value = target?.closest?.(".ReactPiano__Key")?.dataset.midi;
  const midi = value == null ? null : Number(value);
  return Number.isFinite(midi) ? midi : null;
}

export default function Keyboard({
  note,
  onPlay,
  showLabels = true,
  highlightTarget = true,
}) {
  const containerRef = useRef(null);
  const touchNotes = useRef(new Map());
  const [width, setWidth] = useState(320);
  const [pressed, setPressed] = useState([]);
  const targetMidi = note?.midi ?? null;
  const range = useMemo(() => keyboardRangeForNote(note), [note?.octave]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return undefined;
    const measure = () =>
      setWidth(Math.max(1, Math.floor(host.clientWidth || 320)));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    let frame;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
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
      key.classList.toggle(
        "music-keyboard__key-target",
        highlightTarget && midi === targetMidi,
      );
      key.classList.toggle(
        "music-keyboard__key-pressed",
        pressed.includes(midi),
      );
      key.setAttribute(
        "aria-label",
        `${attrs.note}${attrs.note === "C4" ? ", Middle C" : ""}${highlightTarget && midi === targetMidi ? ", selected target key" : ""}`,
      );
      key.setAttribute("aria-pressed", String(pressed.includes(midi)));
    });
  }, [range, width, targetMidi, showLabels, highlightTarget, pressed]);

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

  function handleKey(event, down) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const midi = midiFromTarget(event.target);
    if (midi == null) return;
    event.preventDefault();
    if (!event.repeat) (down ? play : stop)(midi);
  }

  const handleTouchStart = useCallback(
    (event) => {
      const keyTouches = Array.from(event.changedTouches, (touch) => {
        return [touch, midiFromTarget(touch.target)];
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
      onKeyDown={(event) => handleKey(event, true)}
      onKeyUp={(event) => handleKey(event, false)}
      onBlur={(event) => {
        const midi = midiFromTarget(event.target);
        if (midi != null) stop(midi);
      }}
    >
      {targetMidi != null && showLabels && (
        <span
          className={`music-keyboard__target ${highlightTarget ? "" : "is-hidden"}`}
          aria-live={highlightTarget ? "polite" : undefined}
          aria-hidden={!highlightTarget}
        >
          {showLabels
            ? `Target key: ${note.id}${note.id === "C4" ? " · Middle C" : ""}`
            : "Target key highlighted"}
        </span>
      )}
      <div className="music-keyboard__keys">
        <ControlledPiano
          noteRange={range}
          activeNotes={pressed}
          {...pianoInputProps}
          width={width}
          keyWidthToHeight={width / NATURAL_KEYS / KEY_HEIGHT}
          renderNoteLabel={({ midiNumber, isAccidental }) => {
            if (!showLabels) {
              return highlightTarget && midiNumber === targetMidi ? (
                <span
                  className="music-keyboard__target-marker"
                  aria-hidden="true"
                >
                  ?
                </span>
              ) : null;
            }
            if (isAccidental) return null;
            const attrs = MidiNumbers.getAttributes(midiNumber);
            return (
              <span className="music-keyboard__key-label">{attrs.note}</span>
            );
          }}
        />
      </div>
      {targetMidi != null && highlightTarget && (
        <span className="sr-only">Selected piano key: {note.id}</span>
      )}
    </div>
  );
}
