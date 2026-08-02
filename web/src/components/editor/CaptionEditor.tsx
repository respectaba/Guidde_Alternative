"use client";
import { useState } from "react";
import type { Step } from "@guide/shared";
import { generateCaption } from "@guide/shared";

/**
 * Edits the current step's caption. "Regenerate" asks the server (which uses
 * Claude when AI_PROVIDER=claude) and falls back to the local heuristic so it
 * always works offline / without a key.
 */
export function CaptionEditor({
  step,
  index,
  onChange,
}: {
  step: Step;
  index: number;
  onChange: (caption: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/ai/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ element: step.element, order: index }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.caption) {
          onChange(data.caption);
          return;
        }
      }
      onChange(generateCaption(step.element, index));
    } catch {
      onChange(generateCaption(step.element, index));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="caption-editor">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <label className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
          Step caption
        </label>
        <button className="btn small ghost" onClick={regenerate} disabled={busy}>
          {busy ? "Generating…" : "✨ Regenerate"}
        </button>
      </div>
      <textarea
        value={step.caption}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Describe this step…"
      />
    </div>
  );
}
