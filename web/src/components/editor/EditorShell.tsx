"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Guide, Step } from "@guide/shared";
import { StepList } from "./StepList";
import { StepCanvas, type Selection, type Tool } from "./StepCanvas";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { CaptionEditor } from "./CaptionEditor";
import { ShareDialog } from "../ShareDialog";
import { ExportButton } from "../export/ExportButton";
import { PlaybackPlayer } from "../playback/PlaybackPlayer";
import "./editor.css";

type SaveState = "idle" | "saving" | "saved" | "error";

export function EditorShell({ initialGuide }: { initialGuide: Guide }) {
  const [guide, setGuide] = useState<Guide>(initialGuide);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#f59e0b");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [preview, setPreview] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [narrating, setNarrating] = useState(false);
  const [narrateMsg, setNarrateMsg] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

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
          <ExportButton guide={guide} />
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
          <PlaybackPlayer guide={guide} />
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
          </aside>
        </div>
      )}
    </main>
  );
}
