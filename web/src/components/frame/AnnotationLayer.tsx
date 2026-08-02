"use client";
import type { Annotation } from "@guide/shared";
import { arrowHead, toPixelPoint, toPixelRect } from "@guide/shared";
import type { Size } from "@/lib/useElementSize";

/**
 * Read-only SVG rendering of a step's annotations at a given pixel size.
 * Shared by playback, the public view, and (underneath the interaction layer)
 * the editor, so annotations always look identical everywhere.
 */
export function AnnotationLayer({
  annotations,
  size,
  selectedId,
}: {
  annotations: Annotation[];
  size: Size;
  selectedId?: string | null;
}) {
  const { width, height } = size;
  if (width === 0 || height === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {annotations.map((a) => {
        const isSelected = a.id === selectedId;
        if (a.type === "highlight") {
          const r = toPixelRect(a.rect, size);
          return (
            <rect
              key={a.id}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={6}
              fill={hexToRgba(a.color, 0.18)}
              stroke={a.color}
              strokeWidth={isSelected ? 4 : 3}
            />
          );
        }
        if (a.type === "arrow") {
          const from = toPixelPoint(a.from, size);
          const to = toPixelPoint(a.to, size);
          const headLen = Math.max(12, Math.min(width, height) * 0.03);
          const [w1, w2] = arrowHead(from, to, headLen);
          return (
            <g key={a.id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={a.color}
                strokeWidth={isSelected ? 5 : 4}
                strokeLinecap="round"
              />
              <polygon
                points={`${to.x},${to.y} ${w1.x},${w1.y} ${w2.x},${w2.y}`}
                fill={a.color}
              />
            </g>
          );
        }
        // text
        const p = toPixelPoint(a.point, size);
        const fontPx = Math.max(12, a.fontSize * height);
        return (
          <g key={a.id}>
            <text
              x={p.x}
              y={p.y}
              fill={a.color}
              fontSize={fontPx}
              fontFamily="Inter, Arial, sans-serif"
              fontWeight={700}
              stroke="#ffffff"
              strokeWidth={fontPx * 0.08}
              paintOrder="stroke"
              style={{ userSelect: "none" }}
            >
              {a.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
