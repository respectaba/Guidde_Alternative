"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrandKit, Guide, Step } from "@guide/shared";
import { StepFrame } from "../frame/StepFrame";
import { CoverSlide } from "./CoverSlide";
import { OutroSlide } from "./OutroSlide";
import { speak, cancelSpeech, type SpeakHandle } from "@/lib/ai/clientTts";
import { DEFAULT_ACCENT } from "@/lib/brandConstants";
import "./playback.css";

type Slide =
  | { kind: "cover" }
  | { kind: "step"; step: Step; stepNo: number }
  | { kind: "outro" };

const DEFAULT_BRAND: BrandKit = { name: null, logo: null, accentColor: DEFAULT_ACCENT };

/**
 * Plays a guide back like a video: an optional branded cover slide, then each
 * step's annotated screenshot with click ping, zoom, and TTS narration,
 * auto-advancing when narration ends. Read-only (editor preview + public view).
 */
export function PlaybackPlayer({
  guide,
  brand,
  trackId,
  source,
}: {
  guide: Guide;
  brand?: BrandKit;
  /** When set, beacon view/complete events for this guide id. */
  trackId?: string;
  source?: "public" | "embed";
}) {
  const kit = brand ?? DEFAULT_BRAND;
  const hasCover = guide.showCover !== false;
  const hasOutro = guide.showOutro !== false;

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    if (hasCover) list.push({ kind: "cover" });
    guide.steps.forEach((step, i) => list.push({ kind: "step", step, stepNo: i }));
    if (hasOutro) list.push({ kind: "outro" });
    return list;
  }, [guide.steps, hasCover, hasOutro]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = slides[index];
  const atEnd = index >= slides.length - 1;

  const stopAudio = useCallback(() => {
    cancelSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  // ---- viewer analytics (public/embed only) ----
  const viewedRef = useRef(false);
  const completedRef = useRef(false);
  const beacon = useCallback(
    (type: "view" | "complete") => {
      if (!trackId) return;
      const url = `/api/guides/${trackId}/events`;
      const body = JSON.stringify({ type, source: source ?? "public" });
      try {
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        } else {
          void fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          });
        }
      } catch {
        /* analytics is best-effort */
      }
    },
    [trackId, source],
  );

  useEffect(() => {
    if (trackId && !viewedRef.current) {
      viewedRef.current = true;
      beacon("view");
    }
  }, [trackId, beacon]);

  // ---- background music (looped, low volume, follows play/pause) ----
  const musicRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const url = guide.musicUrl;
    if (playing && url) {
      let a = musicRef.current;
      if (!a) {
        a = new Audio(url);
        a.loop = true;
        a.volume = 0.12;
        musicRef.current = a;
      }
      void a.play().catch(() => {});
    } else {
      musicRef.current?.pause();
    }
  }, [playing, guide.musicUrl]);
  useEffect(
    () => () => {
      musicRef.current?.pause();
      musicRef.current = null;
    },
    [],
  );

  // Narrate + auto-advance whenever we are playing on a given slide.
  useEffect(() => {
    if (!playing || !current) return;
    let cancelled = false;
    let handle: SpeakHandle | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const advance = () => {
      if (cancelled) return;
      if (index < slides.length - 1) {
        setIndex((i) => i + 1);
      } else {
        setPlaying(false);
        if (!completedRef.current) {
          completedRef.current = true;
          beacon("complete");
        }
      }
    };

    const narration =
      current.kind === "cover"
        ? [guide.title, guide.subtitle].filter(Boolean).join(". ")
        : current.kind === "outro"
          ? "Thanks for watching"
          : current.step.caption;
    const audioUrl = current.kind === "step" ? current.step.audioUrl : undefined;
    const dwellMs = Math.max(2800, narration.split(/\s+/).length * 320);

    if (muted) {
      timer = setTimeout(advance, dwellMs / Math.max(0.5, rate));
    } else if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.playbackRate = rate;
      audioRef.current = audio;
      audio.onended = advance;
      audio.onerror = () => (timer = setTimeout(advance, dwellMs));
      void audio.play().catch(() => {
        timer = setTimeout(advance, dwellMs);
      });
    } else {
      handle = speak(narration, rate);
      handle.done.then(advance);
    }

    return () => {
      cancelled = true;
      handle?.cancel();
      if (timer) clearTimeout(timer);
      stopAudio();
    };
  }, [playing, index, muted, rate, current, slides.length, guide.title, guide.subtitle, stopAudio, beacon]);

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
    setIndex(Math.max(0, Math.min(slides.length - 1, i)));
  };

  if (!current) {
    return <div className="muted">This guide has no steps yet.</div>;
  }

  const label =
    current.kind === "cover"
      ? "Cover"
      : current.kind === "outro"
        ? "Outro"
        : `${current.stepNo + 1} / ${guide.steps.length}`;
  const caption =
    current.kind === "cover"
      ? guide.title
      : current.kind === "outro"
        ? "Thanks for watching"
        : current.step.caption;

  return (
    <div className="player">
      <div className="player-stage">
        {current.kind === "cover" ? (
          <CoverSlide title={guide.title} subtitle={guide.subtitle} brand={kit} />
        ) : current.kind === "outro" ? (
          <OutroSlide brand={kit} ctaText={guide.ctaText} ctaUrl={guide.ctaUrl} />
        ) : (
          <StepFrame
            key={`${current.step.id}-${playing ? "play" : "pause"}`}
            step={current.step}
            animateClick={playing}
            zoomActive={playing}
          />
        )}
      </div>

      <div className="player-caption">
        <span className="step-index">{label}</span>
        <p>{caption}</p>
      </div>

      <div className="player-controls">
        <button className="btn small" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous">
          ◀ Prev
        </button>
        <button className="btn primary" onClick={togglePlay} aria-label="Play or pause">
          {playing ? "❚❚ Pause" : atEnd ? "↻ Replay" : "▶ Play"}
        </button>
        <button className="btn small" onClick={() => goTo(index + 1)} disabled={atEnd} aria-label="Next">
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
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Playback speed">
            <option value={0.75}>0.75×</option>
            <option value={1}>1×</option>
            <option value={1.25}>1.25×</option>
            <option value={1.5}>1.5×</option>
          </select>
        </label>
      </div>

      <div className="player-scrubber">
        {slides.map((s, i) => (
          <button
            key={s.kind === "step" ? s.step.id : s.kind}
            className={`seg ${i === index ? "active" : ""} ${i < index ? "done" : ""}`}
            onClick={() => goTo(i)}
            aria-label={s.kind === "step" ? `Go to step ${s.stepNo + 1}` : s.kind}
            title={s.kind === "step" ? s.step.caption : s.kind}
          />
        ))}
      </div>
    </div>
  );
}
