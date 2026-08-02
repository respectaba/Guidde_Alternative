"use client";
import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import type { Annotation, BlurRegion, Rect, Step } from "@guide/shared";
import { clamp01, rectFromPixelCorners, toPixelPoint, toPixelRect } from "@guide/shared";
import { StepFrame } from "../frame/StepFrame";
import type { Size } from "@/lib/useElementSize";

export type Tool = "select" | "highlight" | "arrow" | "text" | "blur" | "click";

export interface Selection {
  id: string;
  kind: "annotation" | "blur";
}

/** Interactive editing surface: draw/select/move annotations and blur regions. */
export function StepCanvas({
  step,
  tool,
  color,
  selection,
  onChange,
  onSelect,
  onToolDone,
}: {
  step: Step;
  tool: Tool;
  color: string;
  selection: Selection | null;
  onChange: (step: Step) => void;
  onSelect: (sel: Selection | null) => void;
  onToolDone: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<{ start: { x: number; y: number }; cur: { x: number; y: number } } | null>(null);
  const moveRef = useRef<{ sel: Selection; last: { x: number; y: number } } | null>(null);

  const normFromEvent = (e: React.PointerEvent): { x: number; y: number } => {
    const el = overlayRef.current!;
    const rect = el.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  };

  const hitTest = (p: { x: number; y: number }): Selection | null => {
    // topmost first: annotations drawn after blur, and later array items on top
    for (let i = step.annotations.length - 1; i >= 0; i--) {
      const a = step.annotations[i];
      if (a.type === "highlight" && pointInRect(p, a.rect)) return { id: a.id, kind: "annotation" };
      if (a.type === "text" && near(p, a.point, 0.04)) return { id: a.id, kind: "annotation" };
      if (a.type === "arrow" && (near(p, a.from, 0.03) || near(p, a.to, 0.03))) return { id: a.id, kind: "annotation" };
    }
    for (let i = step.blurRegions.length - 1; i >= 0; i--) {
      if (pointInRect(p, step.blurRegions[i].rect)) return { id: step.blurRegions[i].id, kind: "blur" };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = normFromEvent(e);

    if (tool === "click") {
      onChange({ ...step, click: p });
      onToolDone();
      return;
    }
    if (tool === "text") {
      const value = window.prompt("Annotation text:");
      if (value && value.trim()) {
        const ann: Annotation = {
          id: nanoid(6),
          type: "text",
          point: p,
          value: value.trim(),
          color,
          fontSize: 0.03,
        };
        onChange({ ...step, annotations: [...step.annotations, ann] });
      }
      onToolDone();
      return;
    }
    if (tool === "select") {
      const hit = hitTest(p);
      onSelect(hit);
      if (hit) moveRef.current = { sel: hit, last: p };
      return;
    }
    // drawing tools: highlight / arrow / blur
    setDraft({ start: p, cur: p });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (moveRef.current) {
      const p = normFromEvent(e);
      const { sel, last } = moveRef.current;
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      moveRef.current.last = p;
      onChange(translate(step, sel, dx, dy));
      return;
    }
    if (draft) {
      setDraft({ ...draft, cur: normFromEvent(e) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (moveRef.current) {
      moveRef.current = null;
      return;
    }
    if (!draft) return;
    const { start, cur } = draft;
    setDraft(null);

    if (tool === "highlight" || tool === "blur") {
      const rect = rectFromPixelCorners(start.x, start.y, cur.x, cur.y, { width: 1, height: 1 });
      if (rect.w < 0.01 || rect.h < 0.01) {
        onToolDone();
        return;
      }
      if (tool === "highlight") {
        const ann: Annotation = { id: nanoid(6), type: "highlight", rect, color };
        onChange({ ...step, annotations: [...step.annotations, ann] });
      } else {
        const region: BlurRegion = { id: nanoid(6), rect, intensity: 0.02 };
        onChange({ ...step, blurRegions: [...step.blurRegions, region] });
      }
    } else if (tool === "arrow") {
      const dist = Math.hypot(cur.x - start.x, cur.y - start.y);
      if (dist > 0.02) {
        const ann: Annotation = { id: nanoid(6), type: "arrow", from: start, to: cur, color };
        onChange({ ...step, annotations: [...step.annotations, ann] });
      }
    }
    onToolDone();
  };

  const renderDraftPreview = (size: Size) => {
    if (!draft || size.width === 0) return null;
    if (tool === "highlight" || tool === "blur") {
      const r = toPixelRect(
        rectFromPixelCorners(draft.start.x, draft.start.y, draft.cur.x, draft.cur.y, { width: 1, height: 1 }),
        size,
      );
      return (
        <div
          style={{
            position: "absolute",
            left: r.x,
            top: r.y,
            width: r.w,
            height: r.h,
            border: `2px dashed ${tool === "blur" ? "#94a3b8" : color}`,
            background: tool === "blur" ? "rgba(148,163,184,0.15)" : "rgba(99,102,241,0.12)",
            pointerEvents: "none",
          }}
        />
      );
    }
    if (tool === "arrow") {
      const a = toPixelPoint(draft.start, size);
      const b = toPixelPoint(draft.cur, size);
      return (
        <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width={size.width} height={size.height}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={4} strokeDasharray="6 4" />
        </svg>
      );
    }
    return null;
  };

  const cursor =
    tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";

  return (
    <StepFrame
      step={step}
      selectedId={selection?.id}
      showClick
      overlay={(size) => (
        <div
          ref={overlayRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ position: "absolute", inset: 0, cursor, touchAction: "none" }}
        >
          {renderDraftPreview(size)}
          {selection && <SelectionOutline step={step} selection={selection} size={size} />}
        </div>
      )}
    />
  );
}

function SelectionOutline({ step, selection, size }: { step: Step; selection: Selection; size: Size }) {
  let rect: Rect | null = null;
  if (selection.kind === "blur") {
    rect = step.blurRegions.find((b) => b.id === selection.id)?.rect ?? null;
  } else {
    const a = step.annotations.find((x) => x.id === selection.id);
    if (a?.type === "highlight") rect = a.rect;
    else if (a?.type === "text") rect = { x: a.point.x - 0.02, y: a.point.y - 0.04, w: 0.2, h: 0.06 };
    else if (a?.type === "arrow") {
      const minX = Math.min(a.from.x, a.to.x);
      const minY = Math.min(a.from.y, a.to.y);
      rect = { x: minX, y: minY, w: Math.abs(a.to.x - a.from.x), h: Math.abs(a.to.y - a.from.y) };
    }
  }
  if (!rect) return null;
  const r = toPixelRect(rect, size);
  return (
    <div
      style={{
        position: "absolute",
        left: r.x - 4,
        top: r.y - 4,
        width: r.w + 8,
        height: r.h + 8,
        border: "2px solid #22d3ee",
        borderRadius: 6,
        pointerEvents: "none",
        boxShadow: "0 0 0 2px rgba(34,211,238,0.25)",
      }}
    />
  );
}

// ---- helpers ----
function pointInRect(p: { x: number; y: number }, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
function near(p: { x: number; y: number }, q: { x: number; y: number }, tol: number): boolean {
  return Math.hypot(p.x - q.x, p.y - q.y) <= tol;
}
function translate(step: Step, sel: Selection, dx: number, dy: number): Step {
  if (sel.kind === "blur") {
    return {
      ...step,
      blurRegions: step.blurRegions.map((b) =>
        b.id === sel.id ? { ...b, rect: shiftRect(b.rect, dx, dy) } : b,
      ),
    };
  }
  return {
    ...step,
    annotations: step.annotations.map((a) => {
      if (a.id !== sel.id) return a;
      if (a.type === "highlight") return { ...a, rect: shiftRect(a.rect, dx, dy) };
      if (a.type === "text") return { ...a, point: shiftPoint(a.point, dx, dy) };
      return { ...a, from: shiftPoint(a.from, dx, dy), to: shiftPoint(a.to, dx, dy) };
    }),
  };
}
function shiftRect(r: Rect, dx: number, dy: number): Rect {
  return { ...r, x: clamp01(r.x + dx), y: clamp01(r.y + dy) };
}
function shiftPoint(p: { x: number; y: number }, dx: number, dy: number) {
  return { x: clamp01(p.x + dx), y: clamp01(p.y + dy) };
}
