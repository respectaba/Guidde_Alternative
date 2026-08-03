"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BrandKit, Guide, Step } from "@guide/shared";
import { StepList } from "./StepList";
import { StepCanvas, type Selection, type Tool } from "./StepCanvas";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { CaptionEditor } from "./CaptionEditor";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { ShareDialog } from "../ShareDialog";
import { ExportButton } from "../export/ExportButton";
import { PlaybackPlayer } from "../playback/PlaybackPlayer";
import "./editor.css";

type SaveState = "idle" | "saving" | "saved" | "error";

export function EditorShell({
  initialGuide,
  brand,
}: {
  initialGuide: Guide;
  brand?: BrandKit;
}) {
  const [guide, setGuide] = useState<Guide>(initialGuide);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(brand?.accentColor ?? "#f59e0b");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [preview, setPreview] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [narrating, setNarrating] = useState(false);
  const [narrateMsg, setNarrateMsg] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [musicBusy, setMusicBusy] = useState(false);
  const musicInputRef = useRef<HTMLInputElement | null>(null);

  const firstRender = useRef(true);
  const step = guide.steps[activeIndex];

  // ---- Debounced autosave ----
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/guides/${guide.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: guide.title,
            subtitle: guide.subtitle ?? null,
            showCover: guide.showCover !== false,
            showOutro: guide.showOutro !== false,
            ctaText: guide.ctaText ?? null,
            ctaUrl: guide.ctaUrl ?? null,
            isPublic: guide.isPublic,
            steps: guide.steps,
          }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [guide]);

  const updateStep = useCallback(
    (next: Step) => {
      setGuide((g) => ({
        ...g,
        steps: g.steps.map((s, i) => (i === activeIndex ? next : s)),
      }));
    },
    [activeIndex],
  );

  const deleteSelection = useCallback(() => {
    if (!selection || !step) return;
    if (selection.kind === "blur") {
      updateStep({ ...step, blurRegions: step.blurRegions.filter((b) => b.id !== selection.id) });
    } else {
      updateStep({ ...step, annotations: step.annotations.filter((a) => a.id !== selection.id) });
    }
    setSelection(null);
  }, [selection, step, updateStep]);

  // Delete/Backspace removes the selected annotation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, deleteSelection]);

  const generateVoiceover = async () => {
    setNarrating(true);
    setNarrateMsg(null);
    try {
      const res = await fetch(`/api/guides/${guide.id}/narrate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.guide) {
        setGuide(data.guide as Guide);
        setNarrateMsg(`Voiceover ready (${data.engine}). Press Preview to hear it.`);
      } else if (res.status === 501) {
        setNarrateMsg(data.error ?? "Server voiceover isn't configured; playback uses your browser's voice.");
      } else {
        setNarrateMsg(data.error ?? "Voiceover failed.");
      }
    } catch {
      setNarrateMsg("Network error generating voiceover.");
    } finally {
      setNarrating(false);
    }
  };

  const exportVideo = async () => {
    setRendering(true);
    setNarrateMsg("Rendering MP4 (frames + zoom + narration)… this can take a bit.");
    try {
      const res = await fetch(`/api/guides/${guide.id}/video`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.videoUrl) {
        setNarrateMsg(`Video ready (${Math.round((data.bytes ?? 0) / 1024)} KB).`);
        window.open(data.videoUrl, "_blank");
      } else {
        setNarrateMsg(data.error ?? "Video export failed.");
      }
    } catch {
      setNarrateMsg("Network error during video export.");
    } finally {
      setRendering(false);
    }
  };

  const uploadMusic = async (file: File) => {
    setMusicBusy(true);
    setNarrateMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/guides/${guide.id}/music`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.musicUrl) {
        setGuide((g) => ({ ...g, musicUrl: data.musicUrl as string }));
        setNarrateMsg("Background music added. It loops under playback and the exported video.");
      } else {
        setNarrateMsg(data.error ?? "Music upload failed.");
      }
    } catch {
      setNarrateMsg("Network error uploading music.");
    } finally {
      setMusicBusy(false);
      if (musicInputRef.current) musicInputRef.current.value = "";
    }
  };

  const removeMusic = async () => {
    setMusicBusy(true);
    try {
      const res = await fetch(`/api/guides/${guide.id}/music`, { method: "DELETE" });
      if (res.ok) setGuide((g) => ({ ...g, musicUrl: null }));
    } catch {
      /* ignore */
    } finally {
      setMusicBusy(false);
    }
  };

  const onReorder = (steps: Step[]) => {
    const activeId = step?.id;
    setGuide((g) => ({ ...g, steps }));
    const newIdx = steps.findIndex((s) => s.id === activeId);
    if (newIdx >= 0) setActiveIndex(newIdx);
  };

  const onDeleteStep = (i: number) => {
    if (guide.steps.length <= 1) {
      alert("A guide needs at least one step.");
      return;
    }
    setGuide((g) => ({ ...g, steps: g.steps.filter((_, idx) => idx !== i) }));
    setActiveIndex((idx) => Math.max(0, idx > i ? idx - 1 : Math.min(idx, guide.steps.length - 2)));
    setSelection(null);
  };

  return (
    <main className="editor">
      <div className="editor-topbar">
        <div className="row" style={{ flex: 1, minWidth: 0 }}>
          <Link href="/" className="btn small ghost">
            ← All guides
          </Link>
          <input
            className="title-input"
            value={guide.title}
            onChange={(e) => setGuide((g) => ({ ...g, title: e.target.value }))}
          />
        </div>
        <div className="row">
          <span className={`save-state ${saveState}`}>
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "✓ Saved"}
            {saveState === "error" && "⚠ Save failed"}
          </span>
          <button
            className="btn small"
            onClick={generateVoiceover}
            disabled={narrating}
            title="Pre-render narration audio for every step"
          >
            {narrating ? "Generating…" : "🎙 Voiceover"}
          </button>
          <button className="btn small" onClick={() => setPreview((p) => !p)}>
            {preview ? "✎ Edit" : "▶ Preview"}
          </button>
          <ShareDialog
            isPublic={guide.isPublic}
            publicSlug={guide.publicSlug}
            onToggle={(next) => setGuide((g) => ({ ...g, isPublic: next }))}
          />
          <button
            className="btn small"
            onClick={exportVideo}
            disabled={rendering}
            title="Render an MP4 video with zoom and narration"
          >
            {rendering ? "Rendering…" : "🎬 Export MP4"}
          </button>
          <ExportButton guide={guide} brand={brand} />
        </div>
      </div>

      {narrateMsg && (
        <div
          className="muted"
          style={{
            fontSize: 13,
            padding: "8px 12px",
            marginBottom: 12,
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-elevated)",
          }}
        >
          {narrateMsg}
        </div>
      )}

      {preview ? (
        <div style={{ maxWidth: 900, margin: "20px auto" }}>
          <PlaybackPlayer guide={guide} brand={brand} />
        </div>
      ) : (
        <div className="editor-body">
          <aside className="editor-left">
            <div className="panel-label">Steps</div>
            <StepList
              steps={guide.steps}
              activeIndex={activeIndex}
              onSelect={(i) => {
                setActiveIndex(i);
                setSelection(null);
              }}
              onReorder={onReorder}
              onDelete={onDeleteStep}
            />
          </aside>

          <section className="editor-center">
            {step ? (
              <StepCanvas
                step={step}
                tool={tool}
                color={color}
                selection={selection}
                onChange={updateStep}
                onSelect={setSelection}
                onToolDone={() => setTool("select")}
              />
            ) : (
              <div className="muted">No steps.</div>
            )}
          </section>

          <aside className="editor-right">
            <div className="caption-editor">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <label className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
                  Cover slide
                </label>
                <label className="row" style={{ gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={guide.showCover !== false}
                    onChange={(e) => setGuide((g) => ({ ...g, showCover: e.target.checked }))}
                  />
                  Show
                </label>
              </div>
              <input
                value={guide.subtitle ?? ""}
                onChange={(e) => setGuide((g) => ({ ...g, subtitle: e.target.value }))}
                placeholder="Subtitle (optional)"
                style={{
                  width: "100%",
                  background: "var(--bg-panel)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 14,
                }}
              />
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                Logo &amp; accent come from your{" "}
                <Link href="/settings" style={{ color: "var(--accent)" }}>
                  brand kit
                </Link>
                .
              </p>
            </div>

            <div className="caption-editor">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <label className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
                  Outro &amp; call to action
                </label>
                <label className="row" style={{ gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={guide.showOutro !== false}
                    onChange={(e) => setGuide((g) => ({ ...g, showOutro: e.target.checked }))}
                  />
                  Show
                </label>
              </div>
              <input
                value={guide.ctaText ?? ""}
                onChange={(e) => setGuide((g) => ({ ...g, ctaText: e.target.value }))}
                placeholder="Button text (e.g. Get started)"
                maxLength={60}
                style={{
                  width: "100%",
                  background: "var(--bg-panel)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 14,
                }}
              />
              <input
                value={guide.ctaUrl ?? ""}
                onChange={(e) => setGuide((g) => ({ ...g, ctaUrl: e.target.value }))}
                placeholder="Link URL (e.g. yoursite.com/signup)"
                style={{
                  width: "100%",
                  background: "var(--bg-panel)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 14,
                }}
              />
            </div>

            <div className="caption-editor">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <label className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
                  Background music
                </label>
                {guide.musicUrl && (
                  <button
                    className="btn small ghost"
                    onClick={removeMusic}
                    disabled={musicBusy}
                    title="Remove background music"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={musicInputRef}
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/mp4,audio/m4a,audio/aac,audio/ogg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadMusic(f);
                }}
                style={{ display: "none" }}
              />
              <button
                className="btn small"
                onClick={() => musicInputRef.current?.click()}
                disabled={musicBusy}
                style={{ width: "100%" }}
              >
                {musicBusy ? "Uploading…" : guide.musicUrl ? "♪ Replace track" : "♪ Upload track"}
              </button>
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                {guide.musicUrl
                  ? "Loops quietly under narration in playback and export."
                  : "Optional. MP3/WAV/M4A/OGG up to 20MB."}
              </p>
            </div>

            <AnnotationToolbar
              tool={tool}
              setTool={setTool}
              color={color}
              setColor={setColor}
              selection={selection}
              onDeleteSelection={deleteSelection}
            />
            {step && (
              <CaptionEditor
                step={step}
                index={activeIndex}
                onChange={(caption) => updateStep({ ...step, caption })}
              />
            )}
            <AnalyticsPanel guideId={guide.id} />
          </aside>
        </div>
      )}
    </main>
  );
}
