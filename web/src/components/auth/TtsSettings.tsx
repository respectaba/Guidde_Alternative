"use client";
import { useEffect, useState } from "react";

interface Current {
  provider: string | null;
  voice: string | null;
  model: string | null;
  hasKey: boolean;
}

const VOICE_HINT: Record<string, string> = {
  openai: "e.g. alloy, nova, shimmer, echo (optional)",
  elevenlabs: "ElevenLabs voice ID (optional)",
};

export function TtsSettings() {
  const [cur, setCur] = useState<Current | null>(null);
  const [provider, setProvider] = useState<"openai" | "elevenlabs">("openai");
  const [apiKey, setApiKey] = useState("");
  const [voice, setVoice] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/settings/tts");
    if (res.ok) {
      const c: Current = await res.json();
      setCur(c);
      if (c.provider === "openai" || c.provider === "elevenlabs") setProvider(c.provider);
      setVoice(c.voice ?? "");
      setModel(c.model ?? "");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/tts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, voice: voice || undefined, model: model || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setApiKey("");
        setMsg("Saved. Your voiceover now uses this key.");
        await load();
      } else {
        setMsg(data.error ?? "Failed to save.");
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Remove your TTS key? Voiceover falls back to the server default or offline voice.")) return;
    await fetch("/api/settings/tts", { method: "DELETE" });
    setMsg("Removed.");
    await load();
  };

  return (
    <div className="card" style={{ padding: 18, maxWidth: 640, marginBottom: 24 }}>
      <h3 style={{ marginTop: 0 }}>Voiceover (bring your own key)</h3>
      <p className="muted" style={{ fontSize: 14 }}>
        Add your own OpenAI or ElevenLabs key to generate neural narration. Your key is
        encrypted at rest and never shown again.{" "}
        {cur?.hasKey && (
          <strong style={{ color: "var(--success)" }}>
            A {cur.provider} key is currently set (••••).
          </strong>
        )}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label className="muted" style={{ fontSize: 13 }}>
          Provider
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "openai" | "elevenlabs")}
            style={sel}
          >
            <option value="openai">OpenAI (gpt-4o-mini-tts)</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>
        </label>

        <label className="muted" style={{ fontSize: 13 }}>
          API key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={cur?.hasKey ? "•••• (enter a new key to replace)" : "sk-… / xi-…"}
            style={inp}
          />
        </label>

        <div className="row" style={{ gap: 10 }}>
          <label className="muted" style={{ fontSize: 13, flex: 1 }}>
            Voice
            <input
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              placeholder={VOICE_HINT[provider]}
              style={inp}
            />
          </label>
          <label className="muted" style={{ fontSize: 13, flex: 1 }}>
            Model (optional)
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="override" style={inp} />
          </label>
        </div>

        {msg && <p style={{ fontSize: 13, margin: 0 }}>{msg}</p>}

        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary" onClick={save} disabled={busy || (!apiKey && !cur?.hasKey)}>
            {busy ? "…" : "Save key"}
          </button>
          {cur?.hasKey && (
            <button className="btn danger small" onClick={remove}>
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "9px 10px",
  background: "var(--bg-panel)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
};
const sel: React.CSSProperties = { ...inp };
