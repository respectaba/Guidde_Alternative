"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Guide } from "@guide/shared";
import { StepFrame } from "../frame/StepFrame";
import { speak, cancelSpeech, type SpeakHandle } from "@/lib/ai/clientTts";
import "./playback.css";

/**
 * Plays a guide back like a video: renders each step's annotated screenshot,
 * pings the click point, narrates the caption via TTS, and auto-advances when
 * narration ends. Works read-only for both the editor preview and public view.
 */
export function PlaybackPlayer({ guide }: { guide: Guide }) {
  const steps = guide.steps;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const step = steps[index];
  const atEnd = index >= steps.length - 1;

  const stopAudio = useCallback(() => {
    cancelSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  // Narrate + auto-advance whenever we are playing on a given step.
  useEffect(() => {
    if (!playing || !step) return;
    let cancelled = false;
    let handle: SpeakHandle | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const advance = () => {
      if (cancelled) return;
      if (index < steps.length - 1) setIndex((i) => i + 1);
      else setPlaying(false);
    };

    const dwellMs = Math.max(2500, step.caption.split(/\s+/).length * 320);

    if (muted) {
      timer = setTimeout(advance, dwellMs / Math.max(0.5, rate));
    } else if (step.audioUrl) {
      const audio = new Audio(step.audioUrl);
      audio.playbackRate = rate;
      audioRef.current = audio;
      audio.onended = advance;
      audio.onerror = () => (timer = setTimeout(advance, dwellMs));
      void audio.play().catch(() => {
        timer = setTimeout(advance, dwellMs);
      });
    } else {
      handle = speak(step.caption, rate);
      handle.done.then(advance);
    }

    return () => {
      cancelled = true;
      handle?.cancel();
      if (timer) clearTimeout(timer);
      stopAudio();
    };
  }, [playing, index, muted, rate, step, steps.length, stopAudio]);

  const togglePlay = () => {
    if (atEnd && !playing) {
      setIndex(0);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  };

  const goTo = (i: number) => {
    stopAudio();
    setIndex(Math.max(0, Math.min(steps.length - 1, i)));
  };

  if (!step) {
    return <div className="muted">This guide has no steps yet.</div>;
  }

  return (
    <div className="player">
      <div className="player-stage">
        <StepFrame step={step} animateClick={playing} />
      </div>

      <div className="player-caption">
        <span className="step-index">
          {index + 1} / {steps.length}
        </span>
        <p>{step.caption}</p>
      </div>

      <div className="player-controls">
        <button
          className="btn small"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous step"
        >
          ◀ Prev
        </button>

        <button className="btn primary" onClick={togglePlay} aria-label="Play or pause">
          {playing ? "❚❚ Pause" : atEnd ? "↻ Replay" : "▶ Play"}
        </button>

        <button
          className="btn small"
          onClick={() => goTo(index + 1)}
          disabled={atEnd}
          aria-label="Next step"
        >
          Next ▶
        </button>

        <div className="spacer" />

        <button
          className="btn small ghost"
          onClick={() => setMuted((m) => !m)}
          aria-label="Toggle narration"
          title={muted ? "Narration off" : "Narration on"}
        >
          {muted ? "🔇 Muted" : "🔊 Narration"}
        </button>

        <label className="rate">
          Speed
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            aria-label="Playback speed"
          >
            <option value={0.75}>0.75×</option>
            <option value={1}>1×</option>
            <option value={1.25}>1.25×</option>
            <option value={1.5}>1.5×</option>
          </select>
        </label>
      </div>

      <div className="player-scrubber">
        {steps.map((s, i) => (
          <button
            key={s.id}
            className={`seg ${i === index ? "active" : ""} ${i < index ? "done" : ""}`}
            onClick={() => goTo(i)}
            aria-label={`Go to step ${i + 1}`}
            title={s.caption}
          />
        ))}
      </div>
    </div>
  );
}
