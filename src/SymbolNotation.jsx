import { useEffect, useRef } from "react";
import { Beam, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow/bravura";

/** Clear, locally rendered symbol examples. Duration symbols use VexFlow. */
export default function SymbolNotation({ symbol, compact = false }) {
  const hostRef = useRef(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !symbol) return;
    const glyph = symbol.glyph;
    let renderedWidth = 0;
    let frame;
    let active = true;
    const draw = () => {
      if (!active) return;
      renderedWidth = Math.floor(host.clientWidth);
      host.replaceChildren();
      if (glyph.kind === "note" || glyph.kind === "rest" || glyph.kind === "paired-notes") {
        try {
          const scale = 2.8;
          const width = Math.max(compact ? 120 : 240, Math.floor(host.clientWidth || (compact ? 140 : 320)));
          const logicalWidth = width / scale;
          const logicalHeight = compact ? 100 : 150;
          let notes;
          let beam;
          if (glyph.kind === "paired-notes") {
            notes = [0, 1].map(() => new StaveNote({ clef: "treble", keys: ["b/4"], duration: "8" }));
            beam = new Beam(notes);
          } else {
            const duration = glyph.duration;
            const key = glyph.kind === "rest" && duration === "wr" ? "d/5" : "b/4";
            notes = [new StaveNote({ clef: "treble", keys: [key], duration })];
          }
          const voice = new Voice({ numBeats: glyph.kind === "paired-notes" ? 1 : 4, beatValue: 4 }).setStrict(false);
          voice.addTickables(notes);
          new Formatter().joinVoices([voice]).format([voice], logicalWidth - 32);
          const drawNotation = () => {
            host.replaceChildren();
            const renderer = new Renderer(host, Renderer.Backends.SVG);
            renderer.resize(width, logicalHeight * scale);
            const ctx = renderer.getContext();
            ctx.scale(scale, scale);
            const stave = new Stave(7, 30, logicalWidth - 14);
            stave.setContext(ctx).draw();
            voice.draw(ctx, stave);
            beam?.setContext(ctx).draw();
            return stave;
          };
          let stave = drawNotation();
          // VexFlow positions note glyphs from their left anchor, so centering
          // the tick context alone leaves the visible note/group to the right.
          const bounds = notes.map((note) => note.getBoundingBox()).reduce((all, box) => all.mergeWith(box));
          const groupCenter = bounds.getX() + bounds.getW() / 2;
          const shift = logicalWidth / 2 - groupCenter;
          for (const tickContext of new Set(notes.map((note) => note.tickContext))) {
            tickContext?.setX(tickContext.getX() + shift);
          }
          if (Math.abs(shift) > 0.1) stave = drawNotation();
          const renderedSvg = host.querySelector("svg");
          if (renderedSvg) {
            renderedSvg.classList.add("symbol-staff-svg");
            renderedSvg.setAttribute("aria-hidden", "true");
            renderedSvg.style.width = compact ? "auto" : "100%";
            renderedSvg.style.height = compact ? "70px" : "auto";
            const finalBounds = notes.map((note) => note.getBoundingBox()).reduce((all, box) => all.mergeWith(box));
            const padding = compact ? 8 : 12;
            const top = Math.floor(Math.min(finalBounds.getY(), stave.getYForLine(0)) - padding);
            const bottom = Math.ceil(Math.max(finalBounds.getY() + finalBounds.getH(), stave.getYForLine(4)) + padding);
            const viewHeight = bottom - top;
            renderedSvg.setAttribute("viewBox", `0 ${top} ${logicalWidth} ${viewHeight}`);
            renderedSvg.setAttribute("height", String(viewHeight * scale));
          }
        } catch {
          host.replaceChildren();
        }
        return;
      }
      if (glyph.kind === "text") {
        const el = document.createElement("span");
        el.className = "symbol-dynamic-glyph";
        el.textContent = glyph.text;
        host.append(el);
      } else if (glyph.kind === "hairpin") {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 220 74");
        svg.setAttribute("aria-hidden", "true");
        const paths = glyph.direction === "crescendo" ? ["M20 37 L200 12", "M20 37 L200 62"] : ["M20 12 L200 37", "M20 62 L200 37"];
        for (const d of paths) { const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", d); path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "4"); path.setAttribute("fill", "none"); svg.append(path); }
        host.append(svg);
      } else if (glyph.kind === "clef") {
        const span = document.createElement("span");
        span.className = `symbol-clef-glyph ${glyph.clef}`;
        span.textContent = glyph.clef === "treble" ? "𝄞" : "𝄢";
        host.append(span);
      } else if (glyph.kind === "barline") {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 150 90"); svg.setAttribute("aria-hidden", "true");
        for (let i = 0; i < 5; i++) { const line = document.createElementNS(svg.namespaceURI, "line"); line.setAttribute("x1", "12"); line.setAttribute("x2", "138"); line.setAttribute("y1", String(22 + i * 11)); line.setAttribute("y2", String(22 + i * 11)); line.setAttribute("stroke", "currentColor"); line.setAttribute("stroke-width", "2"); svg.append(line); }
        const addBar = (x, thickness) => { const line = document.createElementNS(svg.namespaceURI, "line"); line.setAttribute("x1", String(x)); line.setAttribute("x2", String(x)); line.setAttribute("y1", "20"); line.setAttribute("y2", "68"); line.setAttribute("stroke", "currentColor"); line.setAttribute("stroke-width", String(thickness)); svg.append(line); };
        if (glyph.type === "single") addBar(85, 3);
        if (glyph.type === "repeat-end") {
          // End repeat: two dots on the inside of the thin bar, then the thick bar.
          addBar(96, 2); addBar(108, 6);
          for (const y of [38.5, 49.5]) { const c = document.createElementNS(svg.namespaceURI, "circle"); c.setAttribute("cx", "80"); c.setAttribute("cy", String(y)); c.setAttribute("r", "3"); c.setAttribute("fill", "currentColor"); svg.append(c); }
        }
        host.append(svg);
      }
    };
    Promise.resolve(document.fonts?.ready).then(draw);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (!active || Math.floor(host.clientWidth) === renderedWidth || document.fonts?.status === "loading") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    observer?.observe(host);
    return () => {
      active = false;
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [symbol, compact]);
  return <div className={`music-staff symbol-notation ${compact ? "compact" : ""}`} ref={hostRef} role="img" aria-label="Musical notation symbol" />;
}
