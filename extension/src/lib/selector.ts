/**
 * Extracts metadata about a clicked element: the nearest interactive ancestor,
 * a human-readable label, an inferred role, a reasonably stable CSS selector,
 * and the element's bounding box normalized to the viewport.
 */
import type { ElementMeta, Rect } from "@guide/shared/types";

const INTERACTIVE = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "LABEL"]);

/** Walk up to the nearest interactive/labelled ancestor, capped in depth. */
function interactiveTarget(el: Element): Element {
  let cur: Element | null = el;
  let depth = 0;
  while (cur && depth < 5) {
    if (
      INTERACTIVE.has(cur.tagName) ||
      cur.getAttribute("role") ||
      (cur as HTMLElement).onclick ||
      cur.getAttribute("tabindex")
    ) {
      return cur;
    }
    cur = cur.parentElement;
    depth++;
  }
  return el;
}

function labelFor(el: Element): string | null {
  const he = el as HTMLElement;
  const candidates = [
    he.getAttribute?.("aria-label"),
    (el as HTMLInputElement).value,
    (el as HTMLInputElement).placeholder,
    he.innerText,
    he.getAttribute?.("title"),
    he.getAttribute?.("alt"),
  ];
  for (const c of candidates) {
    if (c && c.trim()) return c.trim().replace(/\s+/g, " ").slice(0, 120);
  }
  return null;
}

function roleFor(el: Element): string | null {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "select") return "combobox";
  if (tag === "textarea") return "textbox";
  if (tag === "input") {
    const t = (el as HTMLInputElement).type;
    if (t === "checkbox") return "checkbox";
    if (t === "radio") return "radio";
    return "textbox";
  }
  return null;
}

/** A short, reasonably resilient CSS selector for the element. */
function cssSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur.nodeType === 1 && depth < 4) {
    const node: Element = cur;
    const parent: Element | null = node.parentElement;
    let part = node.tagName.toLowerCase();
    if (parent) {
      const siblings: Element[] = Array.from(parent.children);
      const sameTag = siblings.filter((c: Element) => c.tagName === node.tagName);
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    if (node.id) {
      parts[0] = `#${CSS.escape(node.id)}`;
      break;
    }
    cur = parent;
    depth++;
  }
  return parts.join(" > ");
}

export function describeElement(clicked: Element): ElementMeta {
  const el = interactiveTarget(clicked);
  const box = el.getBoundingClientRect();
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  const boundingRect: Rect = {
    x: box.left / vw,
    y: box.top / vh,
    w: box.width / vw,
    h: box.height / vh,
  };
  return {
    selector: cssSelector(el),
    tagName: el.tagName.toLowerCase(),
    text: labelFor(el),
    role: roleFor(el),
    boundingRect,
  };
}
