"use client";
import { useEffect, useRef, useState } from "react";

/**
 * One-click "Connect extension": creates a fresh API token and hands it (plus
 * this app's URL) to the Guideflow content script via window.postMessage, so the
 * user never copies a URL or token by hand. Shows a hint if the extension isn't
 * installed (no acknowledgement arrives).
 */
type Status = "idle" | "working" | "connected" | "notfound" | "error";

export function ConnectExtension() {
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      if (e.data?.source === "guideflow-ext" && e.data?.type === "GUIDEFLOW_CONNECTED") {
        if (timer.current) clearTimeout(timer.current);
        setStatus("connected");
        setMsg(null);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const connect = async () => {
    setStatus("working");
    setMsg(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Chrome extension" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        setStatus("error");
        setMsg(data.error ?? "Couldn't create a token.");
        return;
      }
      // Hand the token + this app's origin to the content script.
      window.postMessage(
        { source: "guideflow-app", type: "GUIDEFLOW_CONNECT", apiBase: window.location.origin, token: data.token },
        window.location.origin,
      );
      // If no ack arrives, the extension probably isn't installed.
      timer.current = setTimeout(() => {
        setStatus((s) => (s === "connected" ? s : "notfound"));
      }, 1800);
    } catch {
      setStatus("error");
      setMsg("Network error.");
    }
  };

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <strong style={{ fontSize: 15 }}>Connect the Chrome extension</strong>
          <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
            Installs your URL + a token into the extension automatically — no copy-paste.
          </p>
        </div>
        <button className="btn primary" onClick={connect} disabled={status === "working"}>
          {status === "working" ? "Connecting…" : status === "connected" ? "✓ Connected" : "Connect extension"}
        </button>
      </div>
      {status === "connected" && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          ✅ The extension is connected to this account. Open it on any site and hit <strong>Start recording</strong>.
        </p>
      )}
      {status === "notfound" && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          Couldn&apos;t reach the extension. Make sure it&apos;s <strong>installed and enabled</strong> in Chrome,
          then click Connect again. (You can still connect manually via a token below.)
        </p>
      )}
      {status === "error" && msg && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 0, color: "var(--danger)" }}>{msg}</p>
      )}
    </div>
  );
}
