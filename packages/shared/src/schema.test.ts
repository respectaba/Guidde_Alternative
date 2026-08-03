import { describe, expect, it } from "vitest";
import { createGuideSchema, updateGuideSchema, stepSchema } from "./schema.js";
import type { Step } from "./types.js";

function validStep(): Step {
  return {
    id: "s1",
    order: 0,
    screenshot: "data:image/png;base64,AAAA",
    viewport: { w: 1280, h: 720, dpr: 1 },
    click: { x: 0.5, y: 0.5 },
    caption: "Click the button",
    element: {
      selector: "button#go",
      tagName: "button",
      text: "Go",
      role: "button",
      boundingRect: { x: 0.4, y: 0.4, w: 0.1, h: 0.05 },
    },
    annotations: [
      { id: "a1", type: "highlight", rect: { x: 0.4, y: 0.4, w: 0.1, h: 0.05 }, color: "#f00" },
    ],
    blurRegions: [{ id: "b1", rect: { x: 0, y: 0, w: 0.2, h: 0.1 }, intensity: 0.02 }],
  };
}

describe("schema validation", () => {
  it("accepts a valid create payload", () => {
    const r = createGuideSchema.safeParse({ title: "My guide", steps: [validStep()] });
    expect(r.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const r = createGuideSchema.safeParse({ title: "", steps: [validStep()] });
    expect(r.success).toBe(false);
  });

  it("rejects a guide with no steps", () => {
    const r = createGuideSchema.safeParse({ title: "x", steps: [] });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown annotation type", () => {
    const bad = validStep();
    // @ts-expect-error deliberately malformed
    bad.annotations = [{ id: "a", type: "scribble", rect: {}, color: "#000" }];
    expect(stepSchema.safeParse(bad).success).toBe(false);
  });

  it("requires at least one field on update", () => {
    expect(updateGuideSchema.safeParse({}).success).toBe(false);
    expect(updateGuideSchema.safeParse({ isPublic: true }).success).toBe(true);
  });

  it("accepts cover fields (subtitle, showCover) on update", () => {
    expect(updateGuideSchema.safeParse({ subtitle: "A quick tour", showCover: true }).success).toBe(true);
    expect(updateGuideSchema.safeParse({ subtitle: null }).success).toBe(true);
    expect(updateGuideSchema.safeParse({ showCover: false }).success).toBe(true);
  });

  it("accepts outro fields (showOutro, ctaText, ctaUrl, musicUrl) on update", () => {
    expect(
      updateGuideSchema.safeParse({ showOutro: true, ctaText: "Get started", ctaUrl: "https://x.com" })
        .success,
    ).toBe(true);
    expect(updateGuideSchema.safeParse({ showOutro: false }).success).toBe(true);
    expect(updateGuideSchema.safeParse({ ctaText: null, ctaUrl: null, musicUrl: null }).success).toBe(true);
  });

  it("rejects an over-long CTA button label", () => {
    expect(updateGuideSchema.safeParse({ ctaText: "x".repeat(61) }).success).toBe(false);
  });

  it("validates an arrow annotation shape", () => {
    const step = validStep();
    step.annotations = [
      { id: "ar", type: "arrow", from: { x: 0.1, y: 0.1 }, to: { x: 0.3, y: 0.3 }, color: "#00f" },
    ];
    expect(stepSchema.safeParse(step).success).toBe(true);
  });
});
