import Link from "next/link";
import { redirect } from "next/navigation";
import { listGuides } from "@/lib/guides";
import { getSessionUser } from "@/lib/auth";
import { DeleteGuideButton } from "@/components/DeleteGuideButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const guides = await listGuides(user.id);

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Your guides</h1>
          <p className="muted">
            Capture with the extension, or build a guide by importing a capture.
          </p>
        </div>
        <Link href="/import" className="btn primary">
          + New guide
        </Link>
      </div>

      {guides.length === 0 ? (
        <div className="empty">
          <h2>No guides yet</h2>
          <p>
            Record a workflow with the Guideflow extension, or{" "}
            <Link href="/import" style={{ color: "var(--accent)" }}>
              import a capture
            </Link>{" "}
            to get started. Set up an{" "}
            <Link href="/settings" style={{ color: "var(--accent)" }}>
              API token
            </Link>{" "}
            to connect the extension.
          </p>
        </div>
      ) : (
        <div className="grid">
          {guides.map((g) => (
            <div className="card" key={g.id}>
              <Link href={`/editor/${g.id}`} className="thumb">
                {g.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.thumbnail} alt={g.title} />
                ) : null}
              </Link>
              <div className="body">
                <h3>{g.title}</h3>
                <div className="meta">
                  <span>
                    {g.stepCount} step{g.stepCount === 1 ? "" : "s"}
                  </span>
                  <span>·</span>
                  <span className={`badge ${g.isPublic ? "public" : "private"}`}>
                    {g.isPublic ? "Public" : "Private"}
                  </span>
                </div>
              </div>
              <div className="actions">
                <Link href={`/editor/${g.id}`} className="btn small">
                  Edit
                </Link>
                {g.isPublic && (
                  <Link href={`/guide/${g.publicSlug}`} className="btn small ghost">
                    View
                  </Link>
                )}
                <div className="spacer" />
                <DeleteGuideButton id={g.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
