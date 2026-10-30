# Music Notes

A touch-friendly note-reading practice app for tablets. It runs in the browser and keeps settings on the current device; it has no account or backend.

[Open Music Notes](https://calben.github.io/MusicNotes/)

## Practice

Choose a practice format, then select one or more question types:

- **Choice** — answer each question directly.
- **Flashcards** — reveal each answer and grade yourself.
- **Staff to letter** — choose from A through G.
- **Piano keys** — read a staff note, then tap its matching pitch on the keyboard.
- **Keyboard to letter** — identify the letter shown by a piano key.

Staff to letter is the default question type. Select multiple types to mix them in a round; a single selected type stays focused on that type. The selection works in both Choice and Flashcards. A round has five questions by default; choose 10 or all selected notes in Practice setup. Wrong answers stay on the current note until it is answered correctly, and missed notes return later in the round when possible. Choice rounds show first-try accuracy and elapsed time when complete.

For piano-key answers, the selected pitch must match the note's octave as well as its letter. The keyboard fits C through the next octave's E, showing C, D, and E in both octaves without scrolling or paging. In Flashcards, **Again** puts a missed card at the end of the deck. Tap **Hear the note** or a piano key to hear a synthesized tone.

Middle C is C4. The available natural-note range is C2 through C6. Practice setup lets you choose treble, bass, or both clefs and which notes to include. Both clefs is the default, with **No crossing hands** enabled: C4 can appear on either staff, lower pitches stay in bass, and higher pitches stay in treble. Turn that option off to allow any selected pitch on either staff. An all-notes round starts with each selected note once per selected clef; 5- and 10-note rounds draw from that selected set, cycling it when needed.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Use the local URL printed by Vite. Run `npm test` and `npm run build` to verify a production build; static files are written to `dist/`.

## Screenshot and accessibility review

```sh
npx playwright install chromium
npm run screenshots
```

This starts the app locally and captures every practice mode, configuration control, feedback state, flashcard face, extreme staff pitch, and fitted keyboard range. It uses Chromium only, at tablet sizes of 1024×768 and 768×1024 with touch enabled, plus a 125% enlargement check. Random choices are seeded; correct-answer states use Playwright's clock to remain visible during capture. The gallery includes only projects enabled in the Playwright configuration.

For a quick layout review of the five practice modes in both tablet orientations, run `npx playwright test visual/layout.spec.js`. These captures go to `screenshots/layout-review/`.

Open `screenshots/review/index.html` for the image gallery and contact sheets, or run `npm run screenshots:report` for Playwright's report and failure traces. Full-resolution PNGs, per-view accessibility reports, and control measurements stay beside the gallery. `npm run screenshots:gallery` rebuilds a partial gallery if a run fails. Generated output is ignored by Git.

The suite fails on detected WCAG A/AA violations, page horizontal overflow, clipped control text, broken practice interactions, or a reduction in staff scale. Axe's unresolved checks are recorded as `manualChecks`; gradient backgrounds and rendered music still need visual review. These captures are browser emulation, not a substitute for checking the actual tablet. [Playwright's screenshot documentation](https://playwright.dev/docs/test-snapshots) describes rendering differences between operating systems.

The **Tablet visual review** GitHub Actions workflow runs on relevant pull requests and can also be started manually. It saves screenshots, reports, and failure traces as a downloadable artifact. See `VISUAL_REVIEW.md` for the review and changes made from the initial capture.

## GitHub Pages

Push to `main` or run **Deploy to GitHub Pages** manually. In repository **Settings → Pages**, select **GitHub Actions** as the deployment source. The workflow tests, builds, and deploys `dist/`. Vite uses relative asset paths for repository subpaths and custom domains.

## Libraries

| Library                                                           | Use                        |
| ----------------------------------------------------------------- | -------------------------- |
| [React](https://react.dev/)                                       | Interface and local state  |
| [daisyUI](https://daisyui.com/)                                    | Default light theme, UI components, and flashcard swap |
| [Tailwind CSS](https://tailwindcss.com/)                            | daisyUI build integration through Vite |
| [VexFlow](https://www.vexflow.com/)                               | Staff notation             |
| [Tone.js](https://tonejs.github.io/)                              | Local synthesized playback |
| [react-piano](https://github.com/kevinsqi/react-piano)            | On-screen keyboard         |
| [lodash-es](https://lodash.com/)                                  | Shuffling                  |

## Code map

- `src/App.jsx` — saved settings and the practice setup dialog
- `src/Flashcards.jsx` — self-assessed flashcard deck and flipping
- `src/theme.css` — Tailwind and daisyUI, using the default light theme
- `src/daisy-overrides.css` — tablet sizing and note-reading accessibility adjustments
- `src/music.js` — pure note data, pitch parsing, presets, and settings migration
- `src/audio.js` — audio initialization and synthesized playback
- `src/practice.js` — round creation and answer helpers
- `src/session.js` — pure session state transitions and scoring
- `src/PracticeSession.jsx` — quiz views, elapsed-time summary, and shared answer choices
- `src/Staff.jsx` and `src/Keyboard.jsx` — notation and piano-keyboard components

See `CODE_REVIEW.md` for the refactor and its validation.

## License

MIT. See [LICENSE](LICENSE).
