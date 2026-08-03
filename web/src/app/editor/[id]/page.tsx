import { notFound, redirect } from "next/navigation";
import { getGuide } from "@/lib/guides";
import { getSessionUser } from "@/lib/auth";
import { getBrandKit } from "@/lib/brand";
import { guideRole, roleAtLeast } from "@/lib/workspace";
import { EditorShell } from "@/components/editor/EditorShell";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const guide = await getGuide(params.id);
  if (!guide) notFound();
  const role = await guideRole(user.id, guide);
  if (!role) notFound(); // don't reveal guides the user can't access

  // Branding comes from the guide's creator (workspace-level branding TBD).
  const brand = await getBrandKit(guide.userId);
  return <EditorShell initialGuide={guide} brand={brand} canEdit={roleAtLeast(role, "editor")} />;
}
