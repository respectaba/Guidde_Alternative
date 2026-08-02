"use client";
import type { Point } from "@guide/shared";
import type { Size } from "@/lib/useElementSize";
import { toPixelPoint } from "@guide/shared";

/**
 * A click indicator drawn at the step's normalized click point. When `animate`
 * is true it renders an expanding ripple (playback); otherwise a static dot
 * (editor / PDF-like still).
 */
export function ClickPing({
  point,
  size,
  animate = false,
}: {
  point: Point;
  size: Size;
  animate?: boolean;
}) {
  const { width, height } = size;
  if (width === 0 || height === 0) return null;
  const p = toPixelPoint(point, size);

  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }}
    >
      {animate && (
        <>
          <span className="click-ripple" />
          <span className="click-ripple delay" />
        </>
      )}
      <span className="click-dot" />
    </div>
  );
}
