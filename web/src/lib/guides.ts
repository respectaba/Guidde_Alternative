/**
 * Data-access layer for guides. Centralizes (de)serialization of the `steps`
 * JSON column so route handlers and server components never touch raw strings.
 */
import { nanoid } from "nanoid";
import type { Guide, Step, CreateGuideInput, UpdateGuideInput } from "@guide/shared";
import { prisma } from "./db";

// The Prisma row shape (steps stored as a JSON string).
interface GuideRow {
  id: string;
  title: string;
  publicSlug: string;
  isPublic: boolean;
  steps: string;
  createdAt: Date;
  updatedAt: Date;
}

function rowToGuide(row: GuideRow): Guide {
  let steps: Step[] = [];
  try {
    steps = JSON.parse(row.steps) as Step[];
  } catch {
    steps = [];
  }
  return {
    id: row.id,
    title: row.title,
    publicSlug: row.publicSlug,
    isPublic: row.isPublic,
    steps,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Lightweight summary used by the dashboard (no full screenshots in the list). */
export interface GuideSummary {
  id: string;
  title: string;
  publicSlug: string;
  isPublic: boolean;
  stepCount: number;
  thumbnail: string | null;
  updatedAt: string;
}

export async function listGuides(): Promise<GuideSummary[]> {
  const rows = await prisma.guide.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map((row) => {
    const guide = rowToGuide(row as GuideRow);
    return {
      id: guide.id,
      title: guide.title,
      publicSlug: guide.publicSlug,
      isPublic: guide.isPublic,
      stepCount: guide.steps.length,
      thumbnail: guide.steps[0]?.screenshot ?? null,
      updatedAt: guide.updatedAt,
    };
  });
}

export async function getGuide(id: string): Promise<Guide | null> {
  const row = await prisma.guide.findUnique({ where: { id } });
  return row ? rowToGuide(row as GuideRow) : null;
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const row = await prisma.guide.findUnique({ where: { publicSlug: slug } });
  return row ? rowToGuide(row as GuideRow) : null;
}

export async function createGuide(input: CreateGuideInput): Promise<Guide> {
  const row = await prisma.guide.create({
    data: {
      title: input.title,
      publicSlug: nanoid(12),
      isPublic: false,
      steps: JSON.stringify(normalizeStepOrder(input.steps)),
    },
  });
  return rowToGuide(row as GuideRow);
}

export async function updateGuide(
  id: string,
  input: UpdateGuideInput,
): Promise<Guide | null> {
  const existing = await prisma.guide.findUnique({ where: { id } });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.isPublic !== undefined) data.isPublic = input.isPublic;
  if (input.steps !== undefined) {
    data.steps = JSON.stringify(normalizeStepOrder(input.steps));
  }

  const row = await prisma.guide.update({ where: { id }, data });
  return rowToGuide(row as GuideRow);
}

export async function deleteGuide(id: string): Promise<boolean> {
  try {
    await prisma.guide.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

/** Re-index step.order to match array position so playback is deterministic. */
function normalizeStepOrder(steps: Step[]): Step[] {
  return steps.map((s, i) => ({ ...s, order: i }));
}
