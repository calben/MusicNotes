import { useEffect, useRef } from "react";
import { Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow/bravura";

/** A locally rendered, single-note staff. Hidden by default for quiz prompts. */
export default function Staff({ note, clef = "treble", hiddenLabel = true }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !note) return undefined;
    let observer;
    const draw = () => {
      const width = Math.max(240, Math.floor(host.clientWidth || 320));
      const letterIndex = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
      const noteStep = note.octave * 7 + letterIndex[note.letter];
      const referenceStep = clef === "bass" ? 2 * 7 + 4 : 4 * 7 + 2; // Bottom line: G2 bass, E4 treble.
      const noteY = 80 - (noteStep - referenceStep) * 5;
      const staveY = Math.max(20, 60 - noteY);
      const height = Math.max(170, staveY + 115, staveY + noteY + 25);
      host.replaceChildren();
      const renderer = new Renderer(host, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      const stave = new Stave(12, staveY, width - 24);
      stave.addClef(clef).setContext(context).draw();
      const staveNote = new StaveNote({
        clef,
        keys: [`${note.letter.toLowerCase()}/${note.octave}`],
        duration: "q",
        alignCenter: true,
        autoStem: true,
      });
      const voice = new Voice({ numBeats: 1, beatValue: 4 }).setStrict(false);
      voice.addTickables([staveNote]);
      new Formatter().joinVoices([voice]).format([voice], width - 112);
      voice.draw(context, stave);
      const svg = host.querySelector("svg");
      if (svg) {
        svg.setAttribute("role", "img");
        svg.setAttribute(
          "aria-label",
          hiddenLabel
            ? `${clef} clef staff with one note`
            : `${note.id} on ${clef} clef staff`,
        );
      }
    };
    let active = true;
    // VexFlow 5 bundles its fonts locally, but FontFace loading is asynchronous.
    Promise.resolve(document.fonts?.ready).then(() => {
      if (!active) return;
      try {
        draw();
      } catch (error) {
        host.replaceChildren();
        host.setAttribute("role", "img");
        host.setAttribute("aria-label", `${clef} staff could not be rendered`);
        console.error("Unable to render music staff", error);
      }
    });
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        if (!active) return;
        if (!document.fonts?.status || document.fonts.status === "loaded") {
          try {
            draw();
          } catch (error) {
            console.error("Unable to resize music staff", error);
          }
        }
      });
      observer.observe(host);
    }
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [note, clef, hiddenLabel]);

  return <div className="music-staff" ref={hostRef} />;
}
