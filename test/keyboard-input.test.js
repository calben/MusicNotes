import test from "node:test";
import assert from "node:assert/strict";
import { Piano } from "react-piano";
import { createPianoInputProps } from "../src/music.js";

function makeSynchronousPiano(props) {
  const piano = new Piano(props);
  // react-piano normally updates through React. This small shim lets the test
  // exercise its actual input callbacks without a browser DOM or extra package.
  piano.setState = (update) => {
    const change =
      typeof update === "function" ? update(piano.state, piano.props) : update;
    if (change) piano.state = { ...piano.state, ...change };
  };
  return piano;
}

test("piano input plays each gesture without treating the target as held", () => {
  const played = [];
  const props = createPianoInputProps(
    (midi) => played.push(midi),
    () => {},
  );
  assert.equal("activeNotes" in props, false);
  assert.equal(props.playNote(67), undefined);

  const piano = makeSynchronousPiano({
    ...props,
    noteRange: { first: 60, last: 72 },
    width: 320,
  });
  assert.deepEqual(piano.state.activeNotes, []);

  // The library's input callback runs for each press, even while the same key
  // is already in its active set. Releasing and alternating keys remain sound.
  piano.handlePlayNoteInput(67);
  piano.handlePlayNoteInput(67);
  piano.handleStopNoteInput(67);
  piano.handlePlayNoteInput(61);
  assert.deepEqual(played, [67, 67, 61]);
});
