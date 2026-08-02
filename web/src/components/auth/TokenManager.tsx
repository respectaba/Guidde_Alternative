"use client";
import { useEffect, useState } from "react";

interface Token {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function TokenManager() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState("My laptop");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/tokens");
    if (res.ok) setTokens((await res.json()).tokens);
  };
  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setCreating(true);
    setFresh(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setFresh((await res.json()).token);
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this token? The extension using it will stop working.")) return;
    await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Create an API token</h3>
        <p className="muted" style={{ fontSize: 14 }}>
          Paste this into the Guideflow extension so it can save captures to your account.
        </p>
        <div className="row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Token name"
            style={{
              flex: 1,
              padding: "9px 10px",
              background: "var(--bg-panel)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          />
          <button className="btn primary" onClick={create} disabled={creating}>
            {creating ? "…" : "Create token"}
          </button>
        </div>
        {fresh && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.4)",
              borderRadius: 8,
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>
              Copy this token now — it won&apos;t be shown again:
            </p>
            <code
              style={{
                display: "block",
                wordBreak: "break-all",
                fontSize: 13,
                background: "var(--bg-panel)",
                padding: 8,
                borderRadius: 6,
              }}
            >
              {fresh}
            </code>
          </div>
        )}
      </div>

      <h3>Your tokens</h3>
      {tokens.length === 0 ? (
        <p className="muted">No tokens yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tokens.map((t) => (
            <div
              key={t.id}
              className="card"
              style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}
            >
              <div style={{ flex: 1 }}>
                <strong>{t.name}</strong>{" "}
                <code className="muted" style={{ fontSize: 12 }}>
                  {t.prefix}…
                </code>
                <div className="muted" style={{ fontSize: 12 }}>
                  {t.lastUsedAt ? `Last used ${new Date(t.lastUsedAt).toLocaleString()}` : "Never used"}
                </div>
              </div>
              <button className="btn danger small" onClick={() => revoke(t.id)}>
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
