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
  const [copied, setCopied] = useState<"" | "link" | "embed">("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/guide/${publicSlug}`;
  const embed = `<iframe src="${origin}/embed/${publicSlug}" width="720" height="560" style="border:0;border-radius:12px" allow="autoplay; clipboard-write" title="Guideflow guide"></iframe>`;

  const copy = async (what: "link" | "embed", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1500);
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
            <button
              className="btn small primary"
              onClick={() => copy("link", url)}
              disabled={!isPublic}
            >
              {copied === "link" ? "Copied!" : "Copy"}
            </button>
          </div>

          <label className="muted" style={{ fontSize: 12, display: "block", margin: "12px 0 4px" }}>
            Embed
          </label>
          <div className="share-link">
            <input readOnly value={embed} onFocus={(e) => e.currentTarget.select()} />
            <button
              className="btn small"
              onClick={() => copy("embed", embed)}
              disabled={!isPublic}
            >
              {copied === "embed" ? "Copied!" : "Copy"}
            </button>
          </div>

          {!isPublic && (
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
              Turn on public access to share or embed this guide.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
