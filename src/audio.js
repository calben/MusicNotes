import * as Tone from "tone";
import { noteToMidi } from "./music.js";

let synthPromise;

export function unlockAudio() {
  return Tone.start();
}

export async function playNote(noteId) {
  const midi = noteToMidi(noteId);
  if (midi == null) throw new Error(`Unknown note: ${noteId}`);
  // Invoke start synchronously in the input handler before the first await; this
  // preserves the user gesture on mobile browsers such as iOS Safari.
  const startPromise = Tone.start();
  if (!synthPromise) {
    synthPromise = Promise.resolve()
      .then(() =>
        new Tone.PolySynth({
          voice: Tone.Synth,
          // Leave room for rapid taps while earlier tones finish fading out.
          maxPolyphony: 32,
          options: {
            oscillator: { type: "triangle" },
            envelope: {
              attack: 0.015,
              decay: 0.18,
              sustain: 0.22,
              release: 0.8,
            },
            volume: -8,
          },
        }).toDestination(),
      )
      .catch((error) => {
        synthPromise = undefined;
        throw error;
      });
  }
  await startPromise;
  const synth = await synthPromise;
  synth.triggerAttackRelease(
    Tone.Frequency(midi, "midi").toFrequency(),
    "8n",
    Tone.now() + 0.01,
  );
}
