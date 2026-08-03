/**
 * Core domain types shared between the Chrome extension, the web editor,
 * the playback view and the PDF exporter.
 *
 * GEOMETRY CONVENTION: every coordinate that describes a position "on the
 * screenshot" — click points, annotation rects, arrow endpoints, blur regions —
 * is stored as a fraction (0..1) of the screenshot's natural size. This keeps
 * rendering resolution-independent: the editor, playback and PDF all multiply
 * by whatever pixel size they happen to render at.
 */

/** A point in normalized (0..1) screenshot space. */
export interface Point {
  x: number;
  y: number;
}

/** A rectangle in normalized (0..1) screenshot space. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Metadata about the DOM element that was clicked, captured by the extension. */
export interface ElementMeta {
  /** A best-effort, reasonably stable CSS selector. */
  selector: string;
  /** Lowercased tag name, e.g. "button", "a", "input". */
  tagName: string;
  /** Human-readable label: innerText || aria-label || value || placeholder. */
  text: string | null;
  /** ARIA role or an inferred role ("button" | "link" | "input" | ...). */
  role: string | null;
  /** The element's bounding box in normalized screenshot space. */
  boundingRect: Rect;
}

export type AnnotationType = "highlight" | "arrow" | "text";

export interface HighlightAnnotation {
  id: string;
  type: "highlight";
  rect: Rect;
  color: string;
}

export interface ArrowAnnotation {
  id: string;
  type: "arrow";
  from: Point;
  to: Point;
  color: string;
}

export interface TextAnnotation {
  id: string;
  type: "text";
  point: Point;
  value: string;
  color: string;
  /** Font size as a fraction of screenshot height (keeps text scaling correct). */
  fontSize: number;
}

export type Annotation =
  | HighlightAnnotation
  | ArrowAnnotation
  | TextAnnotation;

/** A rectangular region to blur (e.g. to hide sensitive data). */
export interface BlurRegion {
  id: string;
  rect: Rect;
  /** Blur strength as a fraction of screenshot width (0..0.05 is typical). */
  intensity: number;
}

export interface Viewport {
  w: number;
  h: number;
  dpr: number;
}

export interface Step {
  id: string;
  order: number;
  /** Screenshot as a data URL (MVP) — upgrade path is an object-storage URL. */
  screenshot: string;
  viewport: Viewport;
  /** Where the user clicked, in normalized screenshot space. */
  click: Point;
  caption: string;
  element: ElementMeta;
  annotations: Annotation[];
  blurRegions: BlurRegion[];
  /** Pre-rendered narration audio URL, only set when service TTS is used. */
  audioUrl?: string;
}

/** Per-tenant branding applied to cover slides and exports. */
export interface BrandKit {
  name: string | null;
  /** Logo as a data URL, or null. */
  logo: string | null;
  /** Accent color hex, e.g. "#6366f1". */
  accentColor: string;
}

export interface Guide {
  id: string;
  title: string;
  /** Optional cover subtitle. */
  subtitle?: string | null;
  /** Whether to show the cover slide in playback/exports. */
  showCover?: boolean;
  /** Whether to show the outro/CTA slide in playback/exports. */
  showOutro?: boolean;
  /** Call-to-action button label on the outro. */
  ctaText?: string | null;
  /** Call-to-action link. */
  ctaUrl?: string | null;
  /** Background music track URL (served from /api/media). */
  musicUrl?: string | null;
  /** Opaque slug used in the public share URL (/guide/[slug]). */
  publicSlug: string;
  isPublic: boolean;
  steps: Step[];
  /** Owner user id (null for legacy/unowned guides). */
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The payload the extension (or the import page) sends to POST /api/guides.
 * The server assigns id/slug/timestamps.
 */
export interface CreateGuideInput {
  title: string;
  steps: Step[];
}

/** Fields the editor can PATCH on an existing guide. */
export interface UpdateGuideInput {
  title?: string;
  subtitle?: string | null;
  showCover?: boolean;
  showOutro?: boolean;
  ctaText?: string | null;
  ctaUrl?: string | null;
  musicUrl?: string | null;
  isPublic?: boolean;
  steps?: Step[];
}
