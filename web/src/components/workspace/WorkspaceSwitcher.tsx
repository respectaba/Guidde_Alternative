"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Workspace {
  id: string;
  name: string;
  personal: boolean;
  role: "viewer" | "editor" | "admin" | "owner";
}

/**
 * Header dropdown to switch the active workspace, create a new one, and jump to
 * member management. Switching sets a cookie server-side and refreshes so server
 * components re-read the active workspace.
 */
export function WorkspaceSwitcher({
  initialWorkspaces,
  initialActiveId,
}: {
  initialWorkspaces: Workspace[];
  initialActiveId: string;
}) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const switchTo = async (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/workspaces/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      if (res.ok) {
        setActiveId(id);
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.workspace) {
        setWorkspaces((ws) => [...ws, data.workspace]);
        setName("");
        setCreating(false);
        await switchTo(data.workspace.id);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!active) return null;

  return (
    <div className="ws-switcher" ref={ref}>
      <button className="btn ghost small" onClick={() => setOpen((o) => !o)} aria-haspopup="menu">
        <span aria-hidden style={{ marginRight: 6 }}>{active.personal ? "👤" : "👥"}</span>
        {active.name}
        <span aria-hidden style={{ marginLeft: 6, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div className="ws-menu" role="menu">
          <div className="ws-menu-label">Workspaces</div>
          {workspaces.map((w) => (
            <button
              key={w.id}
              className={`ws-menu-item ${w.id === activeId ? "active" : ""}`}
              onClick={() => switchTo(w.id)}
              disabled={busy}
              role="menuitem"
            >
              <span>{w.personal ? "👤" : "👥"} {w.name}</span>
              {w.id === activeId && <span aria-hidden>✓</span>}
            </button>
          ))}
          <div className="ws-menu-sep" />
          {creating ? (
            <div className="ws-menu-create">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Workspace name"
              />
              <button className="btn small primary" onClick={create} disabled={busy}>
                Create
              </button>
            </div>
          ) : (
            <button className="ws-menu-item" onClick={() => setCreating(true)} role="menuitem">
              ＋ New workspace
            </button>
          )}
          {!active.personal && (
            <Link href="/workspace" className="ws-menu-item" onClick={() => setOpen(false)}>
              ⚙ Manage members
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
