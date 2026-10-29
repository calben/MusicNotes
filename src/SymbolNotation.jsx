import { useEffect, useRef } from "react";
import { Beam, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow/bravura";

/** Clear, locally rendered symbol examples. Duration symbols use VexFlow. */
export default function SymbolNotation({ symbol, compact = false }) {
  const hostRef = useRef(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !symbol) return;
    const glyph = symbol.glyph;
    host.replaceChildren();
    if (glyph.kind === "note" || glyph.kind === "rest" || glyph.kind === "paired-notes") {
      try {
        const width = compact ? 140 : 320;
        const scale = compact ? 1.8 : 2.4;
        const renderer = new Renderer(host, Renderer.Backends.SVG);
        renderer.resize(width * scale, 108 * scale);
        const ctx = renderer.getContext();
        ctx.scale(scale, scale);
        const stave = new Stave(7, 17, width - 14);
        stave.setContext(ctx).draw();
        let notes;
        let beam;
        if (glyph.kind === "paired-notes") {
          notes = [0, 1].map(() => new StaveNote({ clef: "treble", keys: ["b/4"], duration: "8" }));
          beam = new Beam(notes);
        } else {
          const duration = glyph.kind === "rest" ? glyph.duration : glyph.duration;
          const key = glyph.kind === "rest" && duration === "wr" ? "d/5" : "b/4";
          notes = [new StaveNote({ clef: "treble", keys: [key], duration })];
        }
        const voice = new Voice({ numBeats: glyph.kind === "paired-notes" ? 1 : 4, beatValue: 4 }).setStrict(false);
        voice.addTickables(notes);
        new Formatter().joinVoices([voice]).format([voice], width - 32);
        if (notes.length === 1) notes[0].tickContext?.setX(width / 2);
        voice.draw(ctx, stave);
        beam?.setContext(ctx).draw();
        const renderedSvg = host.querySelector("svg");
        if (renderedSvg) {
          renderedSvg.setAttribute("aria-hidden", "true");
          renderedSvg.style.width = compact ? "auto" : "100%";
          renderedSvg.style.height = compact ? "76px" : "auto";
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
      if (glyph.type === "repeat-both") {
        addBar(37, 2); addBar(46, 5); addBar(104, 5); addBar(113, 2);
        for (const [x, y] of [[25, 33], [25, 55], [125, 33], [125, 55]]) { const c = document.createElementNS(svg.namespaceURI, "circle"); c.setAttribute("cx", String(x)); c.setAttribute("cy", String(y)); c.setAttribute("r", "2.8"); c.setAttribute("fill", "currentColor"); svg.append(c); }
      }
      host.append(svg);
    }
  }, [symbol, compact]);
  return <div className={`symbol-notation ${compact ? "compact" : ""}`} ref={hostRef} role="img" aria-label="Musical notation symbol" />;
}
