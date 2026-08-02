# Guideflow — an open Guidde alternative

Capture, edit, narrate, and share step-by-step how-to guides. A Chrome extension
records a click-by-click walkthrough on any website; a Next.js web app turns it
into an annotated, narrated, shareable guide — with playback, blur/annotation
tools, public share links, and PDF export.

<sub>Built with a Manifest V3 extension + Next.js (App Router) + TypeScript + Prisma/SQLite.</sub>

## How it works

```
┌─────────────────┐   click-by-click    ┌──────────────────┐   POST /api/guides   ┌──────────────┐
│ Chrome extension │ ──screenshots +──▶ │ background worker │ ──────────────────▶ │  Next.js app  │
│ (content script) │   element metadata  │ captureVisibleTab │   opens /editor/:id │  + SQLite DB  │
└─────────────────┘                     └──────────────────┘                      └──────────────┘
                                                                                          │
                              edit ▸ annotate ▸ blur ▸ playback ▸ share ▸ export PDF ◀────┘
```

- **Capture** — the extension listens for clicks on any page, grabs a screenshot
  on `mousedown` (before the page navigates) plus the clicked element's text,
  role, and position, and writes a heuristic caption ("Click the 'Submit' button").
- **Edit** — reorder/delete steps, draw highlights, arrows, and text callouts,
  blur sensitive regions, and rewrite captions (optionally with Claude).
- **Play** — auto-advance through steps with a click-point animation and Web
  Speech narration.
- **Share & export** — flip a guide public for a read-only link, or export a PDF.

All geometry (click points, annotations, blur regions) is stored **normalized
(0–1)** to the screenshot, so the editor, playback, and PDF render identically.

## Project layout

```
packages/shared/   Types, zod schemas, caption heuristic, geometry helpers (used by both sides)
web/               Next.js app — frontend + API routes + Prisma/SQLite
extension/         Chrome MV3 extension (Vite + @crxjs/vite-plugin)
```

## Quick start (web app)

```bash
npm install
npm run db:migrate -w web      # create the SQLite schema
npm run db:seed -w web         # 3 demo guides so you can try everything without the extension
npm run dev -w web             # http://localhost:3000
```

Open http://localhost:3000 — the dashboard shows the seeded guides. Click one to
open the **editor**, or view a public one at `/guide/demo-onboarding`.

## The Chrome extension

```bash
npm run build -w extension     # outputs extension/dist
```

Then load it (this part can't be automated in CI — do it manually):

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `extension/dist`.
3. Make sure the web app is running (`npm run dev -w web`).
4. Click the Guideflow toolbar icon → **Start recording** → click through a
   workflow on any site → **Stop & save**. The editor opens with your steps.

The extension POSTs captures to the web app's `/api/guides`. If a browser
policy blocks that, use the **Download JSON** fallback and drop the file on the
web app's **Import capture** page (`/import`).

For live extension development with HMR: `npm run dev -w extension`.

## AI: browser-native by default, Claude optional

Captions and narration work with **zero configuration**:

- **Captions** — a heuristic derives "Click the 'X' button" from element metadata.
- **Narration** — playback uses the browser's Web Speech API.

To upgrade captions to the Claude API, set these in `web/.env` (see `.env.example`):

```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-haiku-4-5   # optional; default is a fast caption model
```

The "Regenerate" button in the editor then calls `/api/ai/caption`, which uses
Claude and falls back to the heuristic on any error. A server TTS integration
point exists at `/api/ai/tts` (`TTS_PROVIDER=service`) but ships unimplemented —
playback uses the browser by default.

## Tests

```bash
npm test                       # shared unit tests + web API integration tests
```

- `packages/shared` — caption heuristic, geometry math, and zod schema round-trips.
- `web` — API CRUD contract (`POST → GET → PATCH → DELETE`) against a throwaway
  SQLite database.

## Tech notes & tradeoffs

- **Persistence:** SQLite via Prisma; `steps` (with base64 screenshots) stored as
  a JSON column. Simple and fully local. For production, move screenshots to
  object storage and store URLs.
- **Annotations:** SVG overlay for live editing/playback; blur via
  `backdrop-filter`. PDF export composites each step onto a canvas from the same
  normalized model (via `web/src/lib/annotations/render.ts`), so exports match
  playback exactly — `html2canvas` is deliberately avoided.
- **Capture timing:** screenshots fire on `mousedown` (capture phase) so the
  frame is grabbed before a click navigates; `captureVisibleTab` is rate-limited,
  so captures are queued in the background worker.
