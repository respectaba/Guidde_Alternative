import { describe, expect, it } from "vitest";
import {
  arrowHead,
  clamp01,
  rectFromPixelCorners,
  toNormalizedPoint,
  toPixelPoint,
  toPixelRect,
} from "./geometry.js";

const size = { width: 1000, height: 500 };

describe("geometry", () => {
  it("converts normalized point to pixels", () => {
    expect(toPixelPoint({ x: 0.5, y: 0.5 }, size)).toEqual({ x: 500, y: 250 });
  });

  it("converts normalized rect to pixels", () => {
    expect(toPixelRect({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, size)).toEqual({
      x: 100,
      y: 100,
      w: 300,
      h: 200,
    });
  });

  it("round-trips a point through normalize/pixel", () => {
    const norm = toNormalizedPoint(250, 125, size);
    expect(norm).toEqual({ x: 0.25, y: 0.25 });
    expect(toPixelPoint(norm, size)).toEqual({ x: 250, y: 125 });
  });

  it("clamps normalized points into [0,1]", () => {
    expect(toNormalizedPoint(-50, 9999, size)).toEqual({ x: 0, y: 1 });
  });

  it("builds a positive rect regardless of drag direction", () => {
    const a = rectFromPixelCorners(400, 300, 100, 100, size);
    const b = rectFromPixelCorners(100, 100, 400, 300, size);
    expect(a).toEqual(b);
    expect(a).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  });

  it("clamp01 bounds values", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });

  it("arrowHead returns two wings behind the tip", () => {
    const [w1, w2] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
    // both wings should be to the left of the tip (smaller x)
    expect(w1.x).toBeLessThan(100);
    expect(w2.x).toBeLessThan(100);
    // symmetric about the horizontal axis
    expect(w1.y).toBeCloseTo(-w2.y, 5);
  });
});
