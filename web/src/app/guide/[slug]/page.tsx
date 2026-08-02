import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuideBySlug } from "@/lib/guides";
import { PlaybackPlayer } from "@/components/playback/PlaybackPlayer";
import { ExportButton } from "@/components/export/ExportButton";

export const dynamic = "force-dynamic";

export default async function PublicGuidePage({
  params,
}: {
  params: { slug: string };
}) {
  const guide = await getGuideBySlug(params.slug);
  if (!guide || !guide.isPublic) notFound();

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>{guide.title}</h1>
          <p className="muted">
            {guide.steps.length} step{guide.steps.length === 1 ? "" : "s"} ·
            Interactive walkthrough
          </p>
        </div>
        <div className="row">
          <ExportButton guide={guide} />
          <Link href="/" className="btn small ghost">
            Made with Guideflow
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <PlaybackPlayer guide={guide} />
      </div>
    </main>
  );
}
