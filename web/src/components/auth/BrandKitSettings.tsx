"use client";
import { useEffect, useState } from "react";
import { DEFAULT_ACCENT } from "@/lib/brandConstants";

/** Read a file and downscale to <=maxPx (longest edge) as a PNG data URL. */
function fileToScaledDataUrl(file: File, maxPx = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function BrandKitSettings() {
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/settings/brand");
    if (res.ok) {
      const b = await res.json();
      setName(b.name ?? "");
      setLogo(b.logo ?? null);
      setAccent(b.accentColor ?? DEFAULT_ACCENT);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLogo(await fileToScaledDataUrl(file));
    } catch {
      setMsg("Couldn't read that image.");
    }
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || null, logo, accentColor: accent }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? "Brand kit saved." : data.error ?? "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 18, maxWidth: 640, marginBottom: 24 }}>
      <h3 style={{ marginTop: 0 }}>Brand kit</h3>
      <p className="muted" style={{ fontSize: 14 }}>
        Your logo and accent color appear on guide cover slides and in PDF/video exports.
      </p>

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: accent,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="logo" style={{ maxWidth: "80%", maxHeight: "80%" }} />
          ) : (
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 28 }}>
              {(name || "G").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="muted" style={{ fontSize: 13 }}>
            Brand name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." style={inp} />
          </label>
          <label className="muted" style={{ fontSize: 13 }}>
            Logo
            <input type="file" accept="image/*" onChange={onLogo} style={{ marginTop: 4 }} />
          </label>
          {logo && (
            <button className="btn danger small" style={{ alignSelf: "flex-start" }} onClick={() => setLogo(null)}>
              Remove logo
            </button>
          )}
          <label className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            Accent color
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
            <code style={{ fontSize: 12 }}>{accent}</code>
          </label>
        </div>
      </div>

      {msg && <p style={{ fontSize: 13, marginBottom: 0 }}>{msg}</p>}
      <div style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={save} disabled={busy}>
          {busy ? "…" : "Save brand kit"}
        </button>
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
