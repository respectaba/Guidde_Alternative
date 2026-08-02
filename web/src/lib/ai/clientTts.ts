"use client";
/**
 * Client-side text-to-speech for playback narration. Uses the Web Speech API
 * (SpeechSynthesis) when available — the zero-config default. When TTS_PROVIDER
 * is "service", steps carry a pre-rendered `audioUrl` which playback prefers.
 *
 * When speech synthesis is unavailable (e.g. headless test browsers), `speak`
 * falls back to a timed promise so auto-advance still works.
 */

export interface SpeakHandle {
  /** Resolves when narration for this utterance finishes (or is cancelled). */
  done: Promise<void>;
  cancel: () => void;
}

/** Estimate reading time in ms (~180 words/min) as a fallback duration. */
function estimateDurationMs(text: string, rate: number): number {
  const words = Math.max(1, text.trim().split(/\s+/).length);
  const base = (words / 180) * 60_000;
  return Math.max(1500, base / Math.max(0.5, rate));
}

export function speak(text: string, rate = 1): SpeakHandle {
  const canSpeak =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";

  if (!canSpeak || !text.trim()) {
    let timer: ReturnType<typeof setTimeout>;
    let resolveFn: () => void;
    const done = new Promise<void>((resolve) => {
      resolveFn = resolve;
      timer = setTimeout(resolve, estimateDurationMs(text || " ", rate));
    });
    return {
      done,
      cancel: () => {
        clearTimeout(timer);
        resolveFn?.();
      },
    };
  }

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = rate;

  let resolveFn: () => void;
  const done = new Promise<void>((resolve) => {
    resolveFn = resolve;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
  });

  // Safety net: some browsers never fire onend for long text.
  const safety = setTimeout(
    () => resolveFn?.(),
    estimateDurationMs(text, rate) + 4000,
  );
  const originalResolve = resolveFn!;
  resolveFn = () => {
    clearTimeout(safety);
    originalResolve();
  };

  window.speechSynthesis.speak(utter);

  return {
    done,
    cancel: () => {
      window.speechSynthesis.cancel();
      clearTimeout(safety);
      resolveFn?.();
    },
  };
}

export function cancelSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
