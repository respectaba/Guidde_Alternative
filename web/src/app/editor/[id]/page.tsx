import { notFound } from "next/navigation";
import { getGuide } from "@/lib/guides";
import { EditorShell } from "@/components/editor/EditorShell";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: { id: string };
}) {
  const guide = await getGuide(params.id);
  if (!guide) notFound();
  return <EditorShell initialGuide={guide} />;
}
