import { useEffect, useRef } from "react";
import { Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow/bravura";

/** A locally rendered, single-note staff. Hidden by default for quiz prompts. */
export default function Staff({
  note,
  clef = "treble",
  hiddenLabel = true,
  compact = false,
}) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !note) return undefined;
    let observer;
    let frame;
    let renderedWidth = 0;
    const draw = () => {
      const scale = 2.8;
      const width = Math.max(240, Math.floor(host.clientWidth || 320));
      renderedWidth = width;
      const logicalWidth = width / scale;
      const letterIndex = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
      const noteStep = note.octave * 7 + letterIndex[note.letter];
      const referenceStep = clef === "bass" ? 2 * 7 + 4 : 4 * 7 + 2; // Bottom line: G2 bass, E4 treble.
      const noteY = 80 - (noteStep - referenceStep) * 5;
      const staveY = Math.max(20, 60 - noteY);
      const logicalHeight = Math.max(
        compact ? 140 : 170,
        staveY + 115,
        staveY + noteY + 25,
      );
      host.replaceChildren();
      host.removeAttribute("role");
      host.removeAttribute("aria-label");
      const renderer = new Renderer(host, Renderer.Backends.SVG);
      renderer.resize(width, Math.ceil(logicalHeight * scale));
      const context = renderer.getContext();
      context.scale(scale, scale);
      const stave = new Stave(12, staveY, logicalWidth - 24);
      stave.addClef(clef).setContext(context).draw();
      const staveNote = new StaveNote({
        clef,
        keys: [`${note.letter.toLowerCase()}/${note.octave}`],
        duration: "q",
        // VexFlow's `sq` note type selects its filled square notehead glyph.
        // Keeping StaveNote's key, stem, and ledger-line logic preserves pitch placement.
        type: "sq",
        alignCenter: true,
        autoStem: true,
      });
      const voice = new Voice({ numBeats: 1, beatValue: 4 }).setStrict(false);
      voice.addTickables([staveNote]);
      new Formatter().joinVoices([voice]).format([voice], logicalWidth - 112);
      voice.draw(context, stave);
      const svg = host.querySelector("svg");
      if (svg) {
        // Use VexFlow's ink metrics; SVG text boxes include unused font ascent.
        // Cropping this space keeps the enlarged notation at its original scale.
        const bounds = staveNote.getBoundingBox();
        for (const modifier of stave.getModifiers()) {
          if (modifier.getCategory() === "Clef") {
            bounds.mergeWith(modifier.getBoundingBox());
          }
        }
        const padding = compact ? 12 : 16;
        const top = Math.floor(
          Math.min(bounds.getY(), stave.getYForLine(0)) - padding,
        );
        const bottom =
          Math.max(bounds.getY() + bounds.getH(), stave.getYForLine(4)) +
          padding;
        const height = Math.ceil(bottom - top);
        svg.setAttribute("viewBox", `0 ${top} ${logicalWidth} ${height}`);
        svg.setAttribute("height", String(height * scale));
        svg.style.width = "100%";
        svg.style.height = "auto";
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
    const renderSafely = () => {
      if (!active) return;
      try {
        draw();
      } catch (error) {
        host.replaceChildren();
        host.setAttribute("role", "img");
        host.setAttribute("aria-label", `${clef} staff could not be rendered`);
        console.error("Unable to render music staff", error);
      }
    };
    // VexFlow bundles its fonts locally, but FontFace loading is asynchronous.
    Promise.resolve(document.fonts?.ready).then(renderSafely);
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        const width = Math.max(240, Math.floor(host.clientWidth || 320));
        if (
          !active ||
          width === renderedWidth ||
          document.fonts?.status === "loading"
        )
          return;
        // Height changes caused by drawing must not recursively redraw the host.
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(renderSafely);
      });
      observer.observe(host);
    }
    return () => {
      active = false;
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [note, clef, hiddenLabel, compact]);

  return <div className="music-staff" ref={hostRef} />;
}
