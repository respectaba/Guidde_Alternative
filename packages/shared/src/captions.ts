/**
 * Heuristic caption generator. Pure and dependency-free so it can run in the
 * extension's service worker (instant, offline) and in the web editor's
 * "Regenerate" button. When AI_PROVIDER=claude, the server produces richer
 * captions instead — but this is always the zero-config default.
 */
import type { ElementMeta } from "./types";

/** Verbs keyed off the element role/tag for a natural-sounding instruction. */
function actionVerb(meta: ElementMeta): string {
  const role = (meta.role ?? "").toLowerCase();
  const tag = meta.tagName.toLowerCase();

  if (tag === "input" || role === "textbox" || role === "searchbox") {
    return "Type into";
  }
  if (tag === "select" || role === "combobox" || role === "listbox") {
    return "Select from";
  }
  if (tag === "a" || role === "link") {
    return "Open";
  }
  if (role === "checkbox" || role === "switch") {
    return "Toggle";
  }
  if (role === "tab") {
    return "Switch to";
  }
  return "Click";
}

/** A readable noun for the target ("button", "link", "field", ...). */
function targetNoun(meta: ElementMeta): string {
  const role = (meta.role ?? "").toLowerCase();
  const tag = meta.tagName.toLowerCase();

  if (role) {
    if (role === "textbox" || role === "searchbox") return "field";
    if (role === "combobox" || role === "listbox") return "dropdown";
    return role;
  }
  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "input") return "field";
  if (tag === "select") return "dropdown";
  return "element";
}

/** Collapse whitespace and trim a label to a sensible length. */
function normalizeLabel(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

/**
 * Produce a single-sentence instruction from clicked-element metadata.
 * Examples:
 *   Click the "Submit" button
 *   Type into the "Email" field
 *   Open the "Settings" link
 */
export function generateCaption(meta: ElementMeta, order?: number): string {
  const verb = actionVerb(meta);
  const noun = targetNoun(meta);
  const label = meta.text ? normalizeLabel(meta.text) : null;

  let sentence: string;
  if (label) {
    sentence = `${verb} the "${label}" ${noun}`;
  } else {
    sentence = `${verb} the ${noun}`;
  }

  if (typeof order === "number") {
    return `Step ${order + 1}: ${sentence}`;
  }
  return sentence;
}
