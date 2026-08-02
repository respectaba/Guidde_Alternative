"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isSignup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setErr(data.error ?? "Something went wrong.");
      }
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 380, margin: "60px auto" }}>
      <h1 style={{ marginBottom: 6 }}>{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {isSignup ? "Start building guides." : "Sign in to your guides."}
      </p>
      <form onSubmit={submit} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 13 }} className="muted">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 13 }} className="muted">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            style={inputStyle}
          />
        </label>
        {err && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{err}</p>}
        <button className="btn primary" disabled={busy} type="submit">
          {busy ? "…" : isSignup ? "Sign up" : "Log in"}
        </button>
      </form>
      <p className="muted" style={{ fontSize: 14, marginTop: 14 }}>
        {isSignup ? (
          <>Already have an account? <Link href="/login" style={{ color: "var(--accent)" }}>Log in</Link></>
        ) : (
          <>New here? <Link href="/signup" style={{ color: "var(--accent)" }}>Create an account</Link></>
        )}
      </p>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
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
