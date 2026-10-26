# Music Notes

A touch-friendly note-reading practice app for tablets. It runs in the browser and keeps settings on the current device; it has no account or backend.

[Open Music Notes](https://calben.github.io/MusicNotes/)

## Practice

Choose one of four ways to answer a note:

- **Flashcards** — reveal the written note's name and octave.
- **Guided letters** — choose from two or three letter buttons, with an optional hint.
- **All letters** — choose from A through G.
- **Piano keys** — tap the matching pitch on the on-screen keyboard.

Guided letters is the default. A round has five notes by default; choose 10 or all selected notes in Practice setup. Wrong answers stay on the current note until it is answered correctly. Guided letters offers increasing help automatically; in the other answer modes, use **Hint** when you want help. You can switch on the optional 60-second challenge for All letters or Piano keys; Guided letters always stays untimed. The challenge ends when time runs out or the selected round is complete. All letters and Piano keys show first-try accuracy and elapsed time when the round ends.

For piano-key answers, the selected pitch must match the note's octave as well as its letter. In Flashcards, **Again** puts a missed card at the end of the deck. Tap **Hear the note** or a piano key to hear a synthesized tone.

Middle C is C4. The available natural-note range is C2 through C6. Practice setup lets you choose treble, bass, or both clefs and which notes to include. Both clefs is the default, with **No crossing hands** enabled: C4 can appear on either staff, lower pitches stay in bass, and higher pitches stay in treble. Turn that option off to allow any selected pitch on either staff. An all-notes round starts with each selected note once per selected clef; 5- and 10-note rounds draw from that selected set, cycling it when needed.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Use the local URL printed by Vite. Run `npm test` and `npm run build` to verify a production build; static files are written to `dist/`.

## GitHub Pages

Push to `main` or run **Deploy to GitHub Pages** manually. In repository **Settings → Pages**, select **GitHub Actions** as the deployment source. The workflow tests, builds, and deploys `dist/`. Vite uses relative asset paths for repository subpaths and custom domains.

## Libraries

| Library                                                           | Use                        |
| ----------------------------------------------------------------- | -------------------------- |
| [React](https://react.dev/)                                       | Interface and local state  |
| [daisyUI](https://daisyui.com/)                                    | Default light theme and UI components |
| [Tailwind CSS](https://tailwindcss.com/)                            | daisyUI build integration through Vite |
| [VexFlow](https://www.vexflow.com/)                               | Staff notation             |
| [Tone.js](https://tonejs.github.io/)                              | Local synthesized playback |
| [react-piano](https://github.com/kevinsqi/react-piano)            | On-screen keyboard         |
| [react-card-flip](https://github.com/AaronCCWong/react-card-flip) | Flashcard flip             |
| [lodash-es](https://lodash.com/)                                  | Shuffling                  |

## Code map

- `src/App.jsx` — setup, practice modes, rounds, and answer handling
- `src/theme.css` — Tailwind and daisyUI, using the default light theme
- `src/daisy-overrides.css` — tablet sizing and note-reading accessibility adjustments
- `src/music.js` — note range, saved settings, notation data, and playback
- `src/practice.js` — round creation and answer helpers
- `src/PracticeSession.jsx` — guided choices, note-name drills, piano quizzes, and timing
- `src/Staff.jsx` and `src/Keyboard.jsx` — notation and piano-keyboard components

## License

MIT. See [LICENSE](LICENSE).
