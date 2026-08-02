"use client";
import { useState } from "react";

/**
 * Toggles a guide's public visibility and copies the shareable link.
 * The link resolves to the read-only /guide/[slug] view.
 */
export function ShareDialog({
  isPublic,
  publicSlug,
  onToggle,
}: {
  isPublic: boolean;
  publicSlug: string;
  onToggle: (next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/guide/${publicSlug}`
      : `/guide/${publicSlug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="share">
      <button className="btn small" onClick={() => setOpen((o) => !o)}>
        🔗 Share
      </button>
      {open && (
        <div className="share-pop">
          <label className="share-toggle">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => onToggle(e.target.checked)}
            />
            Anyone with the link can view
          </label>
          <div className="share-link">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn small primary" onClick={copy} disabled={!isPublic}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          {!isPublic && (
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
              Turn on public access to share this link.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
