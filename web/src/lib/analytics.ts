/**
 * Lightweight viewer analytics for shared guides. Records view/complete events
 * and aggregates owner-facing stats (totals + a 7-day daily series).
 */
import { prisma } from "./db";

export type EventType = "view" | "complete";
export type EventSource = "public" | "embed";

export async function recordEvent(
  guideId: string,
  type: EventType,
  source: EventSource,
): Promise<void> {
  await prisma.guideEvent.create({ data: { guideId, type, source } });
}

export interface GuideStats {
  views: number;
  completions: number;
  /** Completions / views, 0..1. */
  completionRate: number;
  /** Oldest→newest, 7 entries: { date: "YYYY-MM-DD", views } */
  last7: { date: string; views: number }[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getStats(guideId: string): Promise<GuideStats> {
  const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  since.setUTCHours(0, 0, 0, 0);

  const [views, completions, recentViews] = await Promise.all([
    prisma.guideEvent.count({ where: { guideId, type: "view" } }),
    prisma.guideEvent.count({ where: { guideId, type: "complete" } }),
    prisma.guideEvent.findMany({
      where: { guideId, type: "view", createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  // Bucket recent views by UTC day.
  const counts = new Map<string, number>();
  for (const v of recentViews) {
    const k = dayKey(v.createdAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const last7: { date: string; views: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const k = dayKey(d);
    last7.push({ date: k, views: counts.get(k) ?? 0 });
  }

  return {
    views,
    completions,
    completionRate: views > 0 ? completions / views : 0,
    last7,
  };
}

/** View counts for many guides at once (dashboard). */
export async function viewCounts(guideIds: string[]): Promise<Map<string, number>> {
  if (guideIds.length === 0) return new Map();
  const rows = await prisma.guideEvent.groupBy({
    by: ["guideId"],
    where: { guideId: { in: guideIds }, type: "view" },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.guideId, r._count._all]));
}
