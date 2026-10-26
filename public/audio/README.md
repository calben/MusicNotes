# Practice voice clips

These 19 mono, 24 kHz, 16-bit PCM WAVs are generated locally for the short
practice prompts. The reproducible script is
[`tools/generate-voice-lines.py`](../../tools/generate-voice-lines.py).

- Engine: Kokoro 0.9.4, using the cached `hexgrad/Kokoro-82M` model.
- Model snapshot: `f3ff3571791e39611d31c381e3a41a3af07b4987`.
- Preset: `af_heart`, a stock American English voice; no voice cloning or
  recordings of a real person are used.
- The Kokoro package and model are published under the Apache 2.0 license. See the
  [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/README.md)
  and [voice list](https://github.com/hexgrad/kokoro/blob/main/kokoro.js/README.md).
- The generator forces Hugging Face offline mode and does not download models.

The app displays note names as A through G. To make those short recordings
pronounce the letter names clearly, the generator uses the equivalent phonetic
text (`Ay`, `Bee`, `See`, `Dee`, `Ee`, `Eff`, `Gee`) for the letter and “Tap …”
clips. The runtime phrase mapping is in `src/speech.js`.
