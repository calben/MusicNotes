"""Generate the locally bundled practice voice clips with cached Kokoro."""

from __future__ import annotations

import os
from pathlib import Path

# Keep this reproducible on a disconnected machine and prevent surprise model downloads.
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

import numpy as np
import soundfile as sf
from kokoro import KPipeline


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "public" / "audio"
SAMPLE_RATE = 24_000
VOICE = "af_heart"
SPEED = 0.94

# The single-letter prompts are phonetic to ensure the spoken note name, rather
# than an article or another word, is rendered. Runtime captions stay A through G.
LINES = {
    "name-note.wav": "Name this note.",
    "choose-note.wav": "Choose the note name.",
    "piano-key.wav": "Find the matching piano key.",
    "note-a.wav": "Ay.",
    "note-b.wav": "Bee.",
    "note-c.wav": "See.",
    "note-d.wav": "Dee.",
    "note-e.wav": "Ee.",
    "note-f.wav": "Eff.",
    "note-g.wav": "Gee.",
    "try-again.wav": "Try again.",
    "tap-a.wav": "Tap ay.",
    "tap-b.wav": "Tap bee.",
    "tap-c.wav": "Tap see.",
    "tap-d.wav": "Tap dee.",
    "tap-e.wav": "Tap ee.",
    "tap-f.wav": "Tap eff.",
    "tap-g.wav": "Tap gee.",
    "highlighted-key.wav": "Tap the highlighted key.",
}


def trim_silence(audio: np.ndarray) -> np.ndarray:
    """Trim only quiet edges, retaining 60 ms around the detected speech."""
    frame_size = 240  # 10 ms at 24 kHz
    framed = np.pad(audio, (0, (-len(audio)) % frame_size)).reshape(-1, frame_size)
    frame_peak = np.max(np.abs(framed), axis=1)
    voiced = np.flatnonzero(frame_peak >= 0.003)
    if not len(voiced):
        return audio
    margin = int(0.06 * SAMPLE_RATE)
    start = max(0, int(voiced[0]) * frame_size - margin)
    end = min(len(audio), (int(voiced[-1]) + 1) * frame_size + margin)
    return audio[start:end]


def normalize(audio: np.ndarray) -> np.ndarray:
    """Set a consistent voice level with conservative peak headroom."""
    audio = trim_silence(audio.astype(np.float32, copy=False))
    rms = float(np.sqrt(np.mean(audio * audio)))
    peak = float(np.max(np.abs(audio)))
    if not np.isfinite(rms) or rms < 1e-6 or peak < 1e-6:
        raise RuntimeError("Kokoro returned a silent or invalid clip")
    gain = min(0.13 / rms, 0.84 / peak)
    return np.clip(audio * gain, -0.84, 0.84)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pipeline = KPipeline(lang_code="a", device="cpu", repo_id="hexgrad/Kokoro-82M")
    for filename, text in LINES.items():
        segments = [segment.numpy() for _, _, segment in pipeline(text, voice=VOICE, speed=SPEED)]
        if not segments:
            raise RuntimeError(f"Kokoro returned no audio for {filename}")
        audio = normalize(np.concatenate(segments))
        destination = OUTPUT_DIR / filename
        sf.write(destination, audio, SAMPLE_RATE, subtype="PCM_16")
        print(f"{filename}: {len(audio) / SAMPLE_RATE:.2f}s")


if __name__ == "__main__":
    main()
