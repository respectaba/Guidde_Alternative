import { notFound } from "next/navigation";
import { getGuideBySlug } from "@/lib/guides";
import { getBrandKit } from "@/lib/brand";
import { PlaybackPlayer } from "@/components/playback/PlaybackPlayer";

export const dynamic = "force-dynamic";

/** Chromeless player for iframe embedding (public guides only). */
export default async function EmbedPage({ params }: { params: { slug: string } }) {
  const guide = await getGuideBySlug(params.slug);
  if (!guide || !guide.isPublic) notFound();
  const brand = await getBrandKit(guide.userId);

  return (
    <div style={{ padding: 12, maxWidth: 960, margin: "0 auto" }}>
      <PlaybackPlayer guide={guide} brand={brand} trackId={guide.id} source="embed" />
    </div>
  );
}
