"use client";
import { useState } from "react";

type Role = "viewer" | "editor" | "admin" | "owner";

interface Member {
  userId: string;
  email: string;
  role: Role;
  self: boolean;
}
interface Invite {
  id: string;
  email: string;
  role: Role;
  token: string;
  createdAt: string;
}

const ROLES: Role[] = ["viewer", "editor", "admin", "owner"];
const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export function MembersManager({
  workspaceId,
  myRole,
  initialMembers,
  initialInvites,
}: {
  workspaceId: string;
  myRole: Role;
  initialMembers: Member[];
  initialInvites: Invite[];
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canAdmin = RANK[myRole] >= RANK.admin;

  const refresh = async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`);
    const data = await res.json().catch(() => null);
    if (data) {
      setMembers(data.members);
      setInvites(data.invites);
    }
  };

  const invite = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.result?.kind === "added") {
          setMsg(`${data.result.email} was added to the workspace.`);
        } else if (data.result?.kind === "invited") {
          const link = `${window.location.origin}/invite/${data.result.token}`;
          setMsg(`Invite created. Share this link with ${data.result.email}: ${link}`);
        }
        setEmail("");
        await refresh();
      } else {
        setMsg(data.error ?? "Invite failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (userId: string, next: Role) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    if (res.ok) {
      setMembers((ms) => ms.map((m) => (m.userId === userId ? { ...m, role: next } : m)));
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? "Couldn't change role.");
    }
  };

  const remove = async (userId: string) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMembers((ms) => ms.filter((m) => m.userId !== userId));
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? "Couldn't remove member.");
    }
  };

  const copy = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard?.writeText(link).then(() => setMsg("Invite link copied."));
  };

  return (
    <div className="members">
      {canAdmin && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Invite a member</h3>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              style={{ flex: 1, minWidth: 220 }}
            />
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.filter((r) => r !== "owner" || myRole === "owner").map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button className="btn primary" onClick={invite} disabled={busy || !email}>
              {busy ? "Inviting…" : "Invite"}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
            Existing users are added immediately. New users get an invite link to share
            (no email server required).
          </p>
        </div>
      )}

      {msg && (
        <div className="notice" style={{ wordBreak: "break-all" }}>
          {msg}
        </div>
      )}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Members ({members.length})</h3>
        <table className="member-table">
          <tbody>
            {members.map((m) => (
              <tr key={m.userId}>
                <td>
                  {m.email} {m.self && <span className="muted">(you)</span>}
                </td>
                <td style={{ textAlign: "right" }}>
                  {canAdmin && !m.self ? (
                    <select
                      value={m.role}
                      onChange={(e) => updateRole(m.userId, e.target.value as Role)}
                    >
                      {ROLES.filter((r) => r !== "owner" || myRole === "owner").map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`badge ${m.role === "owner" ? "public" : "private"}`}>
                      {m.role}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: "right", width: 90 }}>
                  {(canAdmin || m.self) && (
                    <button className="btn small ghost" onClick={() => remove(m.userId)}>
                      {m.self ? "Leave" : "Remove"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invites.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Pending invites ({invites.length})</h3>
          <table className="member-table">
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="badge private">{i.role}</span>
                  </td>
                  <td style={{ textAlign: "right", width: 90 }}>
                    <button className="btn small ghost" onClick={() => copy(i.token)}>
                      Copy link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
