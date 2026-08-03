import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspaceId, getRole, listMembers, listWorkspaces } from "@/lib/workspace";
import { MembersManager } from "@/components/workspace/MembersManager";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const activeId = await getActiveWorkspaceId(user.id, user.email);
  const [workspaces, role, data] = await Promise.all([
    listWorkspaces(user.id),
    getRole(user.id, activeId),
    listMembers(activeId, user.id),
  ]);
  const active = workspaces.find((w) => w.id === activeId);

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>{active?.name ?? "Workspace"}</h1>
          <p className="muted">
            {active?.personal
              ? "This is your personal workspace. Create a shared workspace to collaborate."
              : "Manage who can access this workspace and what they can do."}
          </p>
        </div>
      </div>

      {active?.personal ? (
        <div className="empty">
          <h2>Personal workspace</h2>
          <p>
            Personal workspaces have a single member — you. Use the workspace switcher
            in the header to create a shared team workspace, then invite people here.
          </p>
        </div>
      ) : (
        <MembersManager
          workspaceId={activeId}
          myRole={role ?? "viewer"}
          initialMembers={data.members}
          initialInvites={data.invites}
        />
      )}
    </main>
  );
}
