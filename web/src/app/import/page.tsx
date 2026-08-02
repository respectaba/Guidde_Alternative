"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Fallback intake for captures exported from the extension as JSON
 * ({ title, steps }). The extension normally POSTs straight to /api/guides and
 * opens the editor; this page is the always-works path if that's blocked.
 */
export default function ImportPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
  };

  const submit = async () => {
    setErr(null);
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      setErr("That doesn't look like valid JSON.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? `Import failed (${res.status}).`);
        return;
      }
      const data = await res.json();
      router.push(`/editor/${data.id}`);
    } catch {
      setErr("Network error while importing.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="page-head">
        <div>
          <h1>Import a capture</h1>
          <p className="muted">
            Paste the JSON exported by the Guideflow extension, or upload the file.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <input type="file" accept="application/json" onChange={onFile} style={{ marginBottom: 12 }} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{ "title": "My guide", "steps": [ ... ] }'
          rows={14}
          style={{
            width: "100%",
            background: "var(--bg-panel)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            fontFamily: "monospace",
            fontSize: 13,
          }}
        />
        {err && (
          <p style={{ color: "var(--danger)", fontSize: 14 }}>{err}</p>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={submit} disabled={busy || !text.trim()}>
            {busy ? "Importing…" : "Import & open editor"}
          </button>
        </div>
      </div>
    </main>
  );
}
