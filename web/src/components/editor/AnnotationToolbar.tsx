"use client";
import type { Tool, Selection } from "./StepCanvas";

const TOOLS: { id: Tool; label: string; icon: string; hint: string }[] = [
  { id: "select", label: "Select", icon: "▣", hint: "Select / move / delete" },
  { id: "highlight", label: "Highlight", icon: "▭", hint: "Drag a highlight box" },
  { id: "arrow", label: "Arrow", icon: "↗", hint: "Drag an arrow" },
  { id: "text", label: "Text", icon: "T", hint: "Click to add a text callout" },
  { id: "blur", label: "Blur", icon: "▚", hint: "Drag to blur sensitive info" },
  { id: "click", label: "Click point", icon: "◎", hint: "Click to set the click marker" },
];

const COLORS = ["#f59e0b", "#ef4444", "#10b981", "#6366f1", "#ec4899", "#0ea5e9"];

export function AnnotationToolbar({
  tool,
  setTool,
  color,
  setColor,
  selection,
  onDeleteSelection,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  selection: Selection | null;
  onDeleteSelection: () => void;
}) {
  return (
    <div className="toolbar">
      <div className="tool-row">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool ${tool === t.id ? "active" : ""}`}
            onClick={() => setTool(t.id)}
            title={t.hint}
          >
            <span className="tool-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="tool-colors">
        <span className="muted" style={{ fontSize: 13 }}>
          Color
        </span>
        {COLORS.map((c) => (
          <button
            key={c}
            className={`swatch ${color === c ? "active" : ""}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      <button
        className="btn danger small"
        onClick={onDeleteSelection}
        disabled={!selection}
      >
        🗑 Delete selected
      </button>
    </div>
  );
}
