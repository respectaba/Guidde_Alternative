/**
 * Runtime validation for everything that crosses a trust boundary:
 * the extension -> API payload and the editor -> API patch. The zod schemas
 * mirror the TypeScript types in types.ts.
 */
import { z } from "zod";

export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const elementMetaSchema = z.object({
  selector: z.string(),
  tagName: z.string(),
  text: z.string().nullable(),
  role: z.string().nullable(),
  boundingRect: rectSchema,
});

export const annotationSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("highlight"),
    rect: rectSchema,
    color: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("arrow"),
    from: pointSchema,
    to: pointSchema,
    color: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("text"),
    point: pointSchema,
    value: z.string(),
    color: z.string(),
    fontSize: z.number(),
  }),
]);

export const blurRegionSchema = z.object({
  id: z.string(),
  rect: rectSchema,
  intensity: z.number(),
});

export const viewportSchema = z.object({
  w: z.number(),
  h: z.number(),
  dpr: z.number(),
});

export const stepSchema = z.object({
  id: z.string(),
  order: z.number(),
  screenshot: z.string(),
  viewport: viewportSchema,
  click: pointSchema,
  caption: z.string(),
  element: elementMetaSchema,
  annotations: z.array(annotationSchema),
  blurRegions: z.array(blurRegionSchema),
  audioUrl: z.string().optional(),
});

export const createGuideSchema = z.object({
  title: z.string().min(1).max(200),
  steps: z.array(stepSchema).min(1),
});

export const updateGuideSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    isPublic: z.boolean().optional(),
    steps: z.array(stepSchema).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateGuidePayload = z.infer<typeof createGuideSchema>;
export type UpdateGuidePayload = z.infer<typeof updateGuideSchema>;
