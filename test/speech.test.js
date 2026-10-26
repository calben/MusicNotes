import test from "node:test";
import assert from "node:assert/strict";
import { cancelSpeech, isSpeechAvailable, speakText } from "../src/speech.js";

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.lang = "";
    this.rate = 1;
    this.pitch = 1;
    this.voice = null;
  }
}

function withGlobals(values, callback) {
  const originals = new Map(
    Object.keys(values).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete globalThis[key];
      else {
        Object.defineProperty(globalThis, key, {
          configurable: true,
          writable: true,
          value,
        });
      }
    }
    return callback();
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

async function withGlobalsAsync(values, callback) {
  const originals = new Map(
    Object.keys(values).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete globalThis[key];
      else {
        Object.defineProperty(globalThis, key, {
          configurable: true,
          writable: true,
          value,
        });
      }
    }
    return await callback();
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

class FakeAudio {
  static instances = [];
  static playOverride = null;

  constructor() {
    this.src = "";
    this.preload = "";
    this.currentTime = 0;
    this.playCalls = 0;
    this.pauseCalls = 0;
    this.onerror = null;
    FakeAudio.instances.push(this);
  }

  play() {
    this.playCalls += 1;
    return FakeAudio.playOverride?.() ?? Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
  }
}

function nativeSpeechRecorder() {
  const spoken = [];
  const synth = {
    cancel() {},
    getVoices() {
      return [];
    },
    speak(utterance) {
      spoken.push(utterance);
    },
  };
  return { spoken, synth };
}

test("speech degrades safely when the browser API is unavailable", () => {
  withGlobals(
    { window: undefined, SpeechSynthesisUtterance: undefined },
    () => {
      assert.equal(isSpeechAvailable(), false);
      assert.equal(speakText("Find the note"), false);
      assert.doesNotThrow(() => cancelSpeech());
    },
  );
});

test("speech cancels queued prompts and speaks an English instruction", () => {
  const spoken = [];
  let cancellations = 0;
  const englishVoice = { name: "English voice", lang: "en-GB" };
  const synth = {
    cancel() {
      cancellations += 1;
    },
    getVoices() {
      return [{ name: "French voice", lang: "fr-FR" }, englishVoice];
    },
    speak(utterance) {
      spoken.push(utterance);
    },
  };

  withGlobals(
    {
      window: {
        speechSynthesis: synth,
        SpeechSynthesisUtterance: FakeUtterance,
      },
      SpeechSynthesisUtterance: undefined,
    },
    () => {
      assert.equal(isSpeechAvailable(), true);
      assert.equal(speakText("Find the note"), true);
      assert.equal(cancellations, 1);
      assert.equal(spoken.length, 1);
      assert.deepEqual(
        {
          text: spoken[0].text,
          lang: spoken[0].lang,
          rate: spoken[0].rate,
          pitch: spoken[0].pitch,
          voice: spoken[0].voice,
        },
        {
          text: "Find the note",
          lang: "en-US",
          rate: 0.92,
          pitch: 1,
          voice: englishVoice,
        },
      );
    },
  );
});

test("disabled speech does not call or enqueue speech", () => {
  let calls = 0;
  const synth = {
    cancel() {
      calls += 1;
    },
    speak() {
      calls += 1;
    },
  };

  withGlobals(
    {
      window: {
        speechSynthesis: synth,
        SpeechSynthesisUtterance: FakeUtterance,
      },
      SpeechSynthesisUtterance: undefined,
    },
    () => {
      assert.equal(speakText("Do not speak", false), false);
      assert.equal(calls, 0);
    },
  );
});

test("cancelSpeech ignores browser cancellation errors", () => {
  withGlobals(
    {
      window: {
        speechSynthesis: {
          cancel() {
            throw new Error("browser teardown");
          },
        },
        SpeechSynthesisUtterance: FakeUtterance,
      },
      SpeechSynthesisUtterance: undefined,
    },
    () => assert.doesNotThrow(() => cancelSpeech()),
  );
});

test("known voice lines use their local recording", async () => {
  const { spoken, synth } = nativeSpeechRecorder();
  await withGlobalsAsync(
    {
      window: {
        Audio: FakeAudio,
        speechSynthesis: synth,
        SpeechSynthesisUtterance: FakeUtterance,
      },
      SpeechSynthesisUtterance: undefined,
    },
    async () => {
      assert.equal(isSpeechAvailable(), true);
      assert.equal(speakText("Name this note."), true);
      assert.equal(FakeAudio.instances.at(-1).src, "./audio/name-note.wav");
      assert.equal(FakeAudio.instances.at(-1).playCalls > 0, true);
      assert.equal(spoken.length, 0);
    },
  );
});

test("recorded phrases reuse the same audio player", async () => {
  const { synth } = nativeSpeechRecorder();
  const before = FakeAudio.instances.length;
  FakeAudio.playOverride = null;
  await withGlobalsAsync(
    {
      window: {
        Audio: FakeAudio,
        speechSynthesis: synth,
        SpeechSynthesisUtterance: FakeUtterance,
      },
      SpeechSynthesisUtterance: undefined,
    },
    async () => {
      speakText("Name this note.");
      const player = FakeAudio.instances.at(-1);
      speakText("Choose the note name.");
      assert.equal(FakeAudio.instances.length - before, before === 0 ? 1 : 0);
      assert.equal(FakeAudio.instances.at(-1), player);
      assert.equal(player.src, "./audio/choose-note.wav");
      assert.equal(player.playCalls >= 2, true);
    },
  );
});

test("cancelled audio rejection does not restart native speech", async () => {
  const { spoken, synth } = nativeSpeechRecorder();
  let rejectPlayback;
  FakeAudio.playOverride = () =>
    new Promise((_, reject) => {
      rejectPlayback = reject;
    });
  await withGlobalsAsync(
    {
      window: {
        Audio: FakeAudio,
        speechSynthesis: synth,
        SpeechSynthesisUtterance: FakeUtterance,
      },
      SpeechSynthesisUtterance: undefined,
    },
    async () => {
      speakText("Tap C.");
      cancelSpeech();
      rejectPlayback(new Error("cancelled playback"));
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(spoken.length, 0);
    },
  );
  FakeAudio.playOverride = null;
});

test("current recorded-line failure falls back to browser speech", async () => {
  const { spoken, synth } = nativeSpeechRecorder();
  FakeAudio.playOverride = () => Promise.reject(new Error("missing recording"));
  await withGlobalsAsync(
    {
      window: {
        Audio: FakeAudio,
        speechSynthesis: synth,
        SpeechSynthesisUtterance: FakeUtterance,
      },
      SpeechSynthesisUtterance: undefined,
    },
    async () => {
      assert.equal(speakText("Try again."), true);
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(spoken.length, 1);
      assert.equal(spoken[0].text, "Try again.");
    },
  );
  FakeAudio.playOverride = null;
});

test("voice off does not create or play a recording", async () => {
  const { spoken, synth } = nativeSpeechRecorder();
  const beforeInstances = FakeAudio.instances.length;
  const beforePlays = FakeAudio.instances.reduce(
    (sum, instance) => sum + instance.playCalls,
    0,
  );
  await withGlobalsAsync(
    {
      window: {
        Audio: FakeAudio,
        speechSynthesis: synth,
        SpeechSynthesisUtterance: FakeUtterance,
      },
      SpeechSynthesisUtterance: undefined,
    },
    async () => {
      assert.equal(speakText("Name this note.", false), false);
      assert.equal(FakeAudio.instances.length, beforeInstances);
      assert.equal(
        FakeAudio.instances.reduce(
          (sum, instance) => sum + instance.playCalls,
          0,
        ),
        beforePlays,
      );
      assert.equal(spoken.length, 0);
    },
  );
});
