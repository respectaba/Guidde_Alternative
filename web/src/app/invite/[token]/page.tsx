import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { AcceptInvite } from "@/components/workspace/AcceptInvite";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const invite = await prisma.invite.findUnique({
    where: { token: params.token },
    include: { workspace: true },
  });
  const user = await getSessionUser();

  if (!invite) {
    return (
      <main>
        <div className="empty">
          <h2>Invite not found</h2>
          <p>This invite link is invalid. Ask whoever invited you to send a new one.</p>
          <Link href="/" className="btn primary">Go home</Link>
        </div>
      </main>
    );
  }

  if (invite.acceptedAt) {
    return (
      <main>
        <div className="empty">
          <h2>Invite already used</h2>
          <p>This invite to <strong>{invite.workspace.name}</strong> has already been redeemed.</p>
          <Link href="/" className="btn primary">Go to your guides</Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="empty">
        <h2>Join {invite.workspace.name}</h2>
        <p>
          You&apos;ve been invited to join <strong>{invite.workspace.name}</strong> as{" "}
          <span className="badge private">{invite.role}</span>.
        </p>
        {user ? (
          <AcceptInvite token={params.token} />
        ) : (
          <p>
            <Link href={`/login?next=/invite/${params.token}`} className="btn primary">
              Sign in to accept
            </Link>{" "}
            <Link href={`/signup?next=/invite/${params.token}`} className="btn ghost">
              Create an account
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
