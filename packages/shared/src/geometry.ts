/**
 * Pure geometry helpers for converting between normalized (0..1) coordinates
 * and pixel coordinates, plus arrow-head math. Shared by the SVG editor layer
 * and the canvas-based PDF exporter so both render identically.
 */
import type { Point, Rect } from "./types";

export interface Size {
  width: number;
  height: number;
}

/** Normalized point -> pixel point given a rendered size. */
export function toPixelPoint(p: Point, size: Size): { x: number; y: number } {
  return { x: p.x * size.width, y: p.y * size.height };
}

/** Normalized rect -> pixel rect given a rendered size. */
export function toPixelRect(
  r: Rect,
  size: Size,
): { x: number; y: number; w: number; h: number } {
  return {
    x: r.x * size.width,
    y: r.y * size.height,
    w: r.w * size.width,
    h: r.h * size.height,
  };
}

/** Pixel point -> normalized point, clamped to [0,1]. */
export function toNormalizedPoint(
  x: number,
  y: number,
  size: Size,
): Point {
  return {
    x: clamp01(x / size.width),
    y: clamp01(y / size.height),
  };
}

/**
 * Build a normalized rect from two pixel corner points (drag start/end),
 * normalizing so w/h are always positive.
 */
export function rectFromPixelCorners(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  size: Size,
): Rect {
  const x1 = Math.min(ax, bx);
  const y1 = Math.min(ay, by);
  const x2 = Math.max(ax, bx);
  const y2 = Math.max(ay, by);
  return {
    x: clamp01(x1 / size.width),
    y: clamp01(y1 / size.height),
    w: clamp01((x2 - x1) / size.width),
    h: clamp01((y2 - y1) / size.height),
  };
}

export function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Compute the two wing points of an arrow head at `tip`, given the direction
 * from `tail` -> `tip`. Returns points in the same pixel space as the inputs.
 */
export function arrowHead(
  tail: { x: number; y: number },
  tip: { x: number; y: number },
  headLength: number,
): [{ x: number; y: number }, { x: number; y: number }] {
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  const spread = Math.PI / 7; // ~25 degrees
  return [
    {
      x: tip.x - headLength * Math.cos(angle - spread),
      y: tip.y - headLength * Math.sin(angle - spread),
    },
    {
      x: tip.x - headLength * Math.cos(angle + spread),
      y: tip.y - headLength * Math.sin(angle + spread),
    },
  ];
}
