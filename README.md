# Guideflow — an open Guidde alternative

Capture, edit, narrate, and share step-by-step how-to guides. A Chrome extension
records a click-by-click walkthrough on any website; a Next.js web app turns it
into an annotated, narrated, shareable guide — with playback, blur/annotation
tools, cinematic zoom, real AI voiceover, **MP4 video export**, public share
links, and PDF export. Multi-user, with per-account ownership.

<sub>Manifest V3 extension + Next.js (App Router) + TypeScript + Prisma/SQLite + ffmpeg.</sub>

## How it works

```
┌─────────────────┐   click-by-click    ┌──────────────────┐   POST /api/guides   ┌──────────────┐
│ Chrome extension │ ──screenshots +──▶ │ background worker │ ──(Bearer token)───▶ │  Next.js app  │
│ (content script) │   element metadata  │ captureVisibleTab │   opens /editor/:id │  + SQLite DB  │
└─────────────────┘                     └──────────────────┘                      └──────────────┘
                                                                                          │
              edit ▸ annotate ▸ blur ▸ voiceover ▸ playback (zoom) ▸ share ▸ PDF ▸ MP4 ◀──┘
```

- **Capture** — the extension listens for clicks on any page, grabs a screenshot
  on `mousedown` (before the page navigates) plus the clicked element's text,
  role, and position, and writes a heuristic caption ("Click the 'Submit' button").
- **Edit** — reorder/delete steps, draw highlights, arrows, and text callouts,
  blur sensitive regions, and rewrite captions (optionally with Claude).
- **Voiceover** — pre-render per-step narration with a real TTS engine.
- **Play** — auto-advance with a cinematic zoom toward each click point and
  narration (audio track, or the browser's voice).
- **Share & export** — public link, PDF, or a rendered **MP4 video**.

All geometry (click points, annotations, blur regions) is stored **normalized
(0–1)** to the screenshot, so the editor, playback, PDF, and video render identically.

## Project layout

```
packages/shared/   Types, zod schemas, caption heuristic, geometry helpers (both sides)
web/               Next.js app — frontend + API + Prisma/SQLite + auth + TTS + video
extension/         Chrome MV3 extension (Vite + @crxjs/vite-plugin)
```

## Quick start

```bash
npm install
cp .env.example web/.env          # then set AUTH_SECRET (any long random string)
npm run db:migrate -w web         # create the SQLite schema
npm run db:seed   -w web          # demo account + 3 demo guides
npm run dev       -w web          # http://localhost:3000
```

Open http://localhost:3000 and **log in with the seeded demo account**:

```
demo@example.com  /  password123
```

The dashboard shows that account's guides. Open one in the **editor**, or view a
public one at `/guide/demo-onboarding` (public guides need no login).

### Optional system tools (for offline voiceover & video)

- **Video export** uses `ffmpeg-static` (installed automatically via npm) plus
  `@napi-rs/canvas` (prebuilt) — no system packages needed.
- **Offline voiceover** (`TTS_PROVIDER=espeak`) needs the `espeak-ng` binary:
  `apt-get install espeak-ng` (Debian/Ubuntu) or `brew install espeak-ng` (macOS).
  Neural providers (OpenAI/ElevenLabs) need no system package — just a key.

## Accounts, ownership & the extension token

- Sign up / log in with email + password; sessions are signed cookies.
- Every guide is owned by its creator. The API rejects cross-account access
  (401 unauthenticated, 403 for someone else's guide); only public guides are
  readable at `/guide/[slug]` without auth.
- The extension authenticates with a **personal API token**. Create one at
  **API tokens** (`/settings`), paste it into the extension popup, and it will
  save captures to your account.

## The Chrome extension

```bash
npm run build -w extension        # outputs extension/dist
```

Load it (can't be automated in CI — do it manually):

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `extension/dist`.
3. Run the web app; log in; create an API token at `/settings`.
4. Click the Guideflow toolbar icon → set the **Web app URL** and paste the
   **API token** → **Start recording** → click through a workflow → **Stop & save**.
   The editor opens with your captured steps.

If a browser policy blocks the direct POST, use the **Import capture** page
(`/import`) with the extension's JSON. Live extension dev: `npm run dev -w extension`.

## AI: browser-native by default, real engines optional

Captions and narration work with **zero configuration** (heuristic captions +
the browser's Web Speech API). Upgrade via `web/.env` (see `.env.example`):

```env
# Richer captions via Claude (falls back to the heuristic on any error)
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...

# Server voiceover — pick one:
TTS_PROVIDER=espeak         # offline, no key (needs the espeak-ng binary)
# TTS_PROVIDER=openai       # neural; set TTS_API_KEY (+ optional TTS_MODEL/TTS_VOICE)
# TTS_PROVIDER=elevenlabs   # neural; set TTS_API_KEY
```

- Editor **🎙 Voiceover** pre-renders per-step audio (`POST /api/guides/:id/narrate`);
  playback then plays the audio track. `/api/ai/caption` and `/api/ai/tts` expose
  single-shot synthesis. Generated media is served from `/api/media/*`.

## Video export

The editor **🎬 Export MP4** button renders the guide to an MP4:
`@napi-rs/canvas` draws each step's frames (screenshot + annotations + blur +
click ripple) with an eased Ken-Burns zoom toward the click point, `ffmpeg`
muxes each with its narration (or synthesizes/silence) and concatenates to a
`+faststart` H.264/AAC file. `POST /api/guides/:id/video` → `{ videoUrl }`.

## Tests

```bash
npm test        # shared unit tests + web data-layer & auth tests (31 total)
```

- `packages/shared` — caption heuristic, geometry math, zod schema round-trips.
- `web` — ownership-scoped guides data layer + auth primitives (password hashing,
  API-token hashing, session tokens) against a throwaway SQLite database.

The Chrome extension's live capture flow is verified separately with a headed
Chromium (Playwright persistent context under `xvfb`); it can't run in plain CI.

## Tech notes & tradeoffs

- **Persistence:** SQLite via Prisma; `steps` (with base64 screenshots) stored as
  a JSON column. For production, move screenshots and generated media to object
  storage (media currently lives in a writable `.media/` dir, served by an API
  route since `next start` won't serve files added to `public/` after build).
- **Auth:** email+password (scrypt), HMAC-signed session cookies, and per-user
  API tokens (sha256-hashed at rest, shown once). No external auth dependency.
- **Annotations/zoom:** SVG overlay + `backdrop-filter` blur on screen; the PDF
  and video composite from the same normalized model (`lib/annotations/render.ts`,
  `lib/video/frame.ts`), so all outputs match playback. `html2canvas` is avoided.
- **Capture timing:** screenshots fire on `mousedown` (capture phase) so the
  frame is grabbed before a click navigates; `captureVisibleTab` is rate-limited,
  so captures are queued in the background worker.
```
