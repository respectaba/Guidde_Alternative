/**
 * Server-side frame renderer for video export, using @napi-rs/canvas (no
 * browser). Draws one animation frame of a step — screenshot fit into a 16:9
 * canvas, blur regions, annotations, an animated click ripple — under a
 * Ken-Burns zoom toward the click point. Geometry matches the on-screen
 * StepFrame/AnnotationLayer so exports look like playback.
 */
import type { SKRSContext2D, Image } from "@napi-rs/canvas";
import { createCanvas } from "@napi-rs/canvas";
import type { Annotation, Step } from "@guide/shared";
import { arrowHead } from "@guide/shared";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fit (contain) an image of natural size into the WxH canvas. */
export function containRect(img: Image, W: number, H: number): Rect {
  const ar = img.width / img.height;
  const canvasAr = W / H;
  if (ar > canvasAr) {
    const w = W;
    const h = W / ar;
    return { x: 0, y: (H - h) / 2, w, h };
  }
  const h = H;
  const w = H * ar;
  return { x: (W - w) / 2, y: 0, w, h };
}

const px = (nx: number, ny: number, r: Rect) => ({
  x: r.x + nx * r.w,
  y: r.y + ny * r.h,
});

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, rad: number) {
  const r = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface FrameOpts {
  W: number;
  H: number;
  zoom: number;
  /** Focal point in canvas px to zoom about. */
  fx: number;
  fy: number;
  /** 0..1 ripple phase for the click marker. */
  ripple: number;
}

export function drawFrame(
  ctx: SKRSContext2D,
  img: Image,
  step: Step,
  opts: FrameOpts,
) {
  const { W, H, zoom, fx, fy, ripple } = opts;
  const rect = containRect(img, W, H);

  // Background
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0b0f1a";
  ctx.fillRect(0, 0, W, H);

  // Zoom transform about the focal point
  ctx.translate(fx, fy);
  ctx.scale(zoom, zoom);
  ctx.translate(-fx, -fy);

  // Screenshot
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);

  // Blur regions -> pixelate (reliable, privacy-preserving)
  for (const b of step.blurRegions) {
    const rx = rect.x + b.rect.x * rect.w;
    const ry = rect.y + b.rect.y * rect.h;
    const rw = b.rect.w * rect.w;
    const rh = b.rect.h * rect.h;
    if (rw < 2 || rh < 2) continue;
    const small = createCanvas(Math.max(2, Math.round(rw / 12)), Math.max(2, Math.round(rh / 12)));
    const sctx = small.getContext("2d");
    // source region within the image's natural pixels
    const sx = b.rect.x * img.width;
    const sy = b.rect.y * img.height;
    sctx.drawImage(img, sx, sy, b.rect.w * img.width, b.rect.h * img.height, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, rx, ry, rw, rh);
    ctx.imageSmoothingEnabled = true;
  }

  // Annotations
  for (const a of step.annotations as Annotation[]) {
    if (a.type === "highlight") {
      const p = px(a.rect.x, a.rect.y, rect);
      const w = a.rect.w * rect.w;
      const h = a.rect.h * rect.h;
      ctx.fillStyle = hexToRgba(a.color, 0.18);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 3;
      roundRect(ctx, p.x, p.y, w, h, 6);
      ctx.fill();
      ctx.stroke();
    } else if (a.type === "arrow") {
      const from = px(a.from.x, a.from.y, rect);
      const to = px(a.to.x, a.to.y, rect);
      const headLen = Math.max(12, Math.min(rect.w, rect.h) * 0.03);
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
      const p = px(a.point.x, a.point.y, rect);
      const fontPx = Math.max(12, a.fontSize * rect.h);
      ctx.font = `700 ${fontPx}px sans-serif`;
      ctx.textBaseline = "alphabetic";
      ctx.lineWidth = fontPx * 0.16;
      ctx.strokeStyle = "#ffffff";
      ctx.strokeText(a.value, p.x, p.y);
      ctx.fillStyle = a.color;
      ctx.fillText(a.value, p.x, p.y);
    }
  }

  // Click ripple + dot
  const c = px(step.click.x, step.click.y, rect);
  const base = Math.max(9, Math.min(rect.w, rect.h) * 0.012);
  const ringR = base + ripple * base * 3.2;
  ctx.beginPath();
  ctx.arc(c.x, c.y, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(99,102,241,${0.7 * (1 - ripple)})`;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c.x, c.y, base + 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c.x, c.y, base, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(99,102,241,0.95)";
  ctx.fill();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
