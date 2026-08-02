/**
 * Canvas rasterization of a step, driven by the SAME normalized model the SVG
 * editor uses (via @guide/shared geometry helpers), so the PDF export looks
 * identical to playback. Runs in the browser (needs a 2D canvas + Image).
 */
import type { Step } from "@guide/shared";
import { arrowHead, toPixelPoint, toPixelRect } from "@guide/shared";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load screenshot image"));
    img.src = src;
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const full =
    m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Draw a full step (screenshot + blur + annotations + click marker) onto a
 * fresh canvas and return it. Canvas size matches the screenshot's natural size.
 */
export async function renderStepToCanvas(
  step: Step,
  opts: { showClick?: boolean } = {},
): Promise<HTMLCanvasElement> {
  const img = await loadImage(step.screenshot);
  const width = img.naturalWidth || step.viewport.w || 1280;
  const height = img.naturalHeight || step.viewport.h || 720;
  const size = { width, height };

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  // Base screenshot
  ctx.drawImage(img, 0, 0, width, height);

  // Blur regions: redraw the image blurred, clipped to each region.
  for (const b of step.blurRegions) {
    const r = toPixelRect(b.rect, size);
    const blurPx = Math.max(4, b.intensity * width);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(img, 0, 0, width, height);
    ctx.restore();
  }

  // Annotations
  for (const a of step.annotations) {
    if (a.type === "highlight") {
      const r = toPixelRect(a.rect, size);
      ctx.fillStyle = hexToRgba(a.color, 0.18);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 3;
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.fill();
      ctx.stroke();
    } else if (a.type === "arrow") {
      const from = toPixelPoint(a.from, size);
      const to = toPixelPoint(a.to, size);
      const headLen = Math.max(12, Math.min(width, height) * 0.03);
      const [w1, w2] = arrowHead(from, to, headLen);
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(w1.x, w1.y);
      ctx.lineTo(w2.x, w2.y);
      ctx.closePath();
      ctx.fill();
    } else {
      const p = toPixelPoint(a.point, size);
      const fontPx = Math.max(12, a.fontSize * height);
      ctx.font = `700 ${fontPx}px Inter, Arial, sans-serif`;
      ctx.textBaseline = "alphabetic";
      ctx.lineWidth = fontPx * 0.16;
      ctx.strokeStyle = "#ffffff";
      ctx.strokeText(a.value, p.x, p.y);
      ctx.fillStyle = a.color;
      ctx.fillText(a.value, p.x, p.y);
    }
  }

  // Click marker
  if (opts.showClick !== false) {
    const c = toPixelPoint(step.click, size);
    const radius = Math.max(8, Math.min(width, height) * 0.012);
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(99, 102, 241, 0.95)";
    ctx.fill();
  }

  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
