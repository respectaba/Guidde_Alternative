"use client";
import type { BlurRegion } from "@guide/shared";
import { toPixelRect } from "@guide/shared";
import type { Size } from "@/lib/useElementSize";

/**
 * Renders blur regions as absolutely-positioned divs using backdrop-filter.
 * Fast and live in the editor; the PDF exporter re-creates the same blur on a
 * canvas so exports match.
 */
export function BlurLayer({
  regions,
  size,
}: {
  regions: BlurRegion[];
  size: Size;
}) {
  const { width, height } = size;
  if (width === 0 || height === 0) return null;

  return (
    <>
      {regions.map((b) => {
        const r = toPixelRect(b.rect, size);
        const blurPx = Math.max(4, b.intensity * width);
        return (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              backdropFilter: `blur(${blurPx}px)`,
              WebkitBackdropFilter: `blur(${blurPx}px)`,
              background: "rgba(255,255,255,0.02)",
              borderRadius: 4,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
}
