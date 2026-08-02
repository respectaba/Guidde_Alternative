import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { error, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return error("Not authenticated", 401);
  const token = await prisma.apiToken.findUnique({ where: { id: params.id } });
  if (!token || token.userId !== user.id) return error("Token not found", 404);
  await prisma.apiToken.delete({ where: { id: params.id } });
  return json({ ok: true });
}
