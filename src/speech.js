export const VOICE_LINES = Object.freeze({
  "Name this note.": "name-note.wav",
  "Choose the note name.": "choose-note.wav",
  "Find the matching piano key.": "piano-key.wav",
  A: "note-a.wav",
  B: "note-b.wav",
  C: "note-c.wav",
  D: "note-d.wav",
  E: "note-e.wav",
  F: "note-f.wav",
  G: "note-g.wav",
  "Try again.": "try-again.wav",
  "Tap A.": "tap-a.wav",
  "Tap B.": "tap-b.wav",
  "Tap C.": "tap-c.wav",
  "Tap D.": "tap-d.wav",
  "Tap E.": "tap-e.wav",
  "Tap F.": "tap-f.wav",
  "Tap G.": "tap-g.wav",
  "Tap the highlighted key.": "highlighted-key.wav",
});

let audioPlayer;
let speechGeneration = 0;
let fallbackGeneration = -1;

function speechApi() {
  if (typeof window === "undefined") return null;
  const synth = window.speechSynthesis;
  const Utterance =
    window.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance;
  return synth && Utterance ? { synth, Utterance } : null;
}

function audioApi() {
  if (typeof window === "undefined" || typeof window.Audio !== "function") {
    return null;
  }
  return window.Audio;
}

function normalizePhrase(text) {
  return String(text)
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getRecordedFile(text) {
  const normalized = normalizePhrase(text);
  return (
    Object.entries(VOICE_LINES).find(
      ([phrase]) => normalizePhrase(phrase) === normalized,
    )?.[1] || null
  );
}

function recordedUrl(filename) {
  const base = import.meta.env?.BASE_URL ?? "./";
  return `${base.endsWith("/") ? base : `${base}/`}audio/${filename}`;
}

function stopAudio() {
  if (!audioPlayer) return;
  audioPlayer.onerror = null;
  try {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  } catch {
    // Audio can be in a non-seekable state while its source is changing.
  }
}

function cancelNativeSpeech(api = speechApi()) {
  try {
    api?.synth.cancel();
  } catch {
    // Speech is optional and some browsers reject cancellation during teardown.
  }
}

function speakNative(text, api) {
  if (!api) return false;
  try {
    const utterance = new api.Utterance(String(text));
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1;
    const englishVoice = api.synth
      .getVoices?.()
      .find((voice) => /^en(-|_|$)/i.test(voice.lang || ""));
    if (englishVoice) utterance.voice = englishVoice;
    api.synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

function fallbackIfCurrent(text, token) {
  if (token !== speechGeneration || fallbackGeneration === token) return false;
  fallbackGeneration = token;
  return speakNative(text, speechApi());
}

function playRecorded(text, filename, AudioConstructor, token) {
  try {
    if (!audioPlayer) {
      audioPlayer = new AudioConstructor();
      audioPlayer.preload = "auto";
    }
    audioPlayer.onerror = () => fallbackIfCurrent(text, token);
    audioPlayer.src = recordedUrl(filename);
    // Start synchronously within the user's gesture so mobile browsers allow playback.
    const playback = audioPlayer.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(() => fallbackIfCurrent(text, token));
    }
    return true;
  } catch {
    return fallbackIfCurrent(text, token);
  }
}

export function isSpeechAvailable() {
  return Boolean(audioApi() || speechApi());
}

export function cancelSpeech() {
  speechGeneration += 1;
  stopAudio();
  cancelNativeSpeech();
}

export function speakText(text, enabled = true) {
  if (!enabled || !text) return false;

  // A new line always supersedes any previous audio or native utterance.
  speechGeneration += 1;
  const token = speechGeneration;
  stopAudio();
  const native = speechApi();
  cancelNativeSpeech(native);

  const AudioConstructor = audioApi();
  const filename = getRecordedFile(text);
  if (AudioConstructor && filename) {
    return playRecorded(text, filename, AudioConstructor, token);
  }
  return speakNative(text, native);
}
