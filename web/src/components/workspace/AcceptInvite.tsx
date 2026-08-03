"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/invites/${token}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setErr(data.error ?? "Couldn't accept the invite.");
      }
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <p>
      <button className="btn primary" onClick={accept} disabled={busy}>
        {busy ? "Joining…" : "Accept invite"}
      </button>
      {err && <span className="muted" style={{ marginLeft: 10 }}>{err}</span>}
    </p>
  );
}
