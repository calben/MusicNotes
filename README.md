# Music Notes Flashcards

A small, touch-friendly music note flashcard app for practicing note reading on a tablet. It runs entirely in the browser; settings are saved on that device and there is no account or backend.

[Open Music Notes](https://calben.github.io/MusicNotes/)

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Use the local URL printed by Vite. To make a production build, run `npm test` and `npm run build`; the static files are written to `dist/`.

## GitHub Pages

Push to `main` or run the **Deploy to GitHub Pages** workflow manually. In the repository's **Settings → Pages**, select **GitHub Actions** as the deployment source. The workflow builds and deploys `dist/`. Vite uses relative asset paths so the site works from a repository subpath as well as a custom domain.

## Libraries

| Library                                                           | Use                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| [React](https://react.dev/)                                       | Interface and local app state                                 |
| [VexFlow](https://www.vexflow.com/)                               | Render staff notation                                         |
| [Tone.js](https://tonejs.github.io/)                              | Generate note playback in the browser, without remote samples |
| [react-piano](https://github.com/kevinsqi/react-piano)            | On-screen keyboard                                            |
| [react-card-flip](https://github.com/AaronCCWong/react-card-flip) | Card flip interaction                                         |
| [lodash-es](https://lodash.com/)                                  | Deck shuffling                                                |

The quiz flow is intentionally local and lightweight; a full quiz framework would add little for this single deck-based practice loop.

## Practice range

Middle C is C4. The available natural-note range is C2 through C6. Open **Practice setup** in the header to choose treble, bass, or both clefs and the notes to include, then press **Start practice**. Setup stays in a dismissible side drawer so the flashcard can use the screen. Closing the drawer without starting keeps the current round. Reveal each answer to see its letter, octave, and highlighted piano key. **Again** returns a missed card to the end of the deck; **Got it** marks it complete. Tap **Hear the note** or any piano key to play a synthesized tone. Your selection is stored in browser local storage on the current device.

The selectable quiz pitches are natural notes; black keys can be played on the answer keyboard. Each selected pitch appears on each selected clef, so choosing both clefs doubles the cards.

## Verification

`npm test` checks note/MIDI accuracy, saved-settings recovery, exact clef/pitch selection, shuffled-deck membership, and repeated piano input. Browser checks covered 1024 × 768 landscape and 768 × 1024 portrait, enlarged notation, note reveal, key highlighting and playback, retry/completion including one-card decks, saved settings, empty selections, and extreme ledger notes. Physical iPad/Safari testing remains a useful final device check.

For a focused piano regression check, run `npm run dev` and open `/test/keyboard.html`. Each click or tap should append exactly one pitch to the event list, even when repeating the highlighted target or a black key. The touch simulation buttons exercise the component's native touch listeners and verify that compatibility mouse events are prevented. This fixture records callbacks without needing speakers and is excluded from the production build.

Development screenshots are in [screenshots/](screenshots/). No remote font or sample requests are needed. The production JavaScript is approximately 504 kB gzipped, including the notation fonts and synthesizer.

## License

MIT. See [LICENSE](LICENSE).

## Code map

- `src/App.jsx` — settings, flashcard flow, and answer handling
- `src/music.js` — note range, settings normalization, deck building, and playback
- `src/Staff.jsx` and `src/Keyboard.jsx` — notation and piano-keyboard components
