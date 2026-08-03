import { notFound, redirect } from "next/navigation";
import { getGuide } from "@/lib/guides";
import { getSessionUser } from "@/lib/auth";
import { getBrandKit } from "@/lib/brand";
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
  if (guide.userId !== user.id) notFound(); // don't reveal others' guides

  const brand = await getBrandKit(user.id);
  return <EditorShell initialGuide={guide} brand={brand} />;
}
