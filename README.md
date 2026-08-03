# Guideflow — an open Guidde alternative

Capture, edit, narrate, and share step-by-step how-to guides. A Chrome extension
records a click-by-click walkthrough on any website; a Next.js web app turns it
into an annotated, narrated, shareable guide — with playback, blur/annotation
tools, cinematic zoom, real AI voiceover, **MP4 video export**, **branded cover
slides**, public share links, an **embeddable player**, **view analytics**, and
PDF export. Multi-user, with per-account ownership.

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
the browser's Web Speech API).

**Neural voiceover — per-tenant "bring your own key" (recommended).** Each user
adds their own OpenAI, ElevenLabs, or Google Cloud TTS key under **Settings**
(`/settings` → Voiceover). Keys are **encrypted at rest** (AES-256-GCM via
`ENCRYPTION_KEY`, falling back to `AUTH_SECRET`) and never returned to the client.
Per-tenant keys mean each account pays for its own usage — the right model for
multi-tenant SaaS. (Google uses an **API key**, not a service-account JSON; the
optional Voice field is a Google voice name like `en-US-Neural2-C`, and Model is
an optional BCP-47 language code.)

**Resolution order** (per user, in `resolveTtsConfig`): the user's saved key →
the operator's env key → offline `espeak` → browser. So self-hosting still works
with a single env key (or offline), and a hosted deployment can require BYO keys:

```env
# Optional operator fallback used when a user hasn't added their own key:
TTS_PROVIDER=espeak         # offline, no key (needs the espeak-ng binary)
# TTS_PROVIDER=openai       # neural; set TTS_API_KEY (+ optional TTS_MODEL/TTS_VOICE)
# TTS_PROVIDER=elevenlabs   # neural; set TTS_API_KEY
# TTS_PROVIDER=google       # neural; set TTS_API_KEY = Google API key

# Richer captions via Claude (falls back to the heuristic on any error)
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
```

- Editor **🎙 Voiceover** pre-renders per-step audio (`POST /api/guides/:id/narrate`);
  playback then plays the audio track. `/api/ai/tts` does single-shot synthesis
  (authenticated; uses the caller's config). Generated media is served from `/api/media/*`.
- **Proxied networks:** Node's `fetch` ignores `HTTPS_PROXY`, so provider calls
  route through an undici `ProxyAgent` when `HTTPS_PROXY` is set (`lib/egress.ts`) —
  no-op otherwise. (Equivalently, run the server with `NODE_USE_ENV_PROXY=1` on
  Node ≥ 22.21.) A blocked host surfaces as a provider/proxy 403 — check egress policy.

### Verify a real key end-to-end

With the server running and a key set (Settings, or `TTS_API_KEY` in `web/.env`):

```bash
node scripts/tts-smoke.mjs demo@example.com password123
# logs in, POSTs /api/ai/tts, writes scratch out.mp3, prints bytes + engine
```

## Branding & cover slides

- **Brand kit** (per tenant, **Settings → Brand kit**): logo (uploaded, downscaled
  client-side, stored as a data URL), accent color, and brand name. Applied to
  cover slides and exports, and used as the default annotation color in the editor.
- **Cover slide**: every guide gets a branded title card (logo, title, subtitle,
  accent gradient) as the first slide in **playback**, the first page in **PDF**,
  and the opening segment in the **MP4** (with the title narrated when server TTS
  is available). Per-guide **subtitle** and a **show/hide cover** toggle live in
  the editor's Cover panel; brand assets come from the brand kit.
- **Outro / call-to-action**: an optional closing slide (logo, "Thanks for
  watching", a CTA button, accent gradient) renders as the last slide in
  **playback**, the final page in **PDF**, and the closing segment in the
  **MP4**. Per-guide **CTA button text**, **link URL**, and a **show/hide**
  toggle live in the editor's Outro panel; the button links out (in the public
  player and embeds) to the URL you provide.
- **Background music**: upload a track (MP3/WAV/M4A/OGG, ≤20MB) in the editor's
  Music panel (`POST /api/guides/:id/music`). It loops quietly under narration
  in **playback** and is mixed under the narration in the exported **MP4**
  (`ffmpeg` `amix` at low volume, ducked below the voice).

## Sharing, embedding & analytics

- **Public link** (`/guide/[slug]`) and a **chromeless embeddable player**
  (`/embed/[slug]`) — the editor's Share menu has copy-paste **link** and
  **`<iframe>` embed** snippets. The embed route renders without site chrome
  (root layout goes chromeless for `/embed` via a pathname header from middleware).
- **View analytics**: `view` and `complete` events are recorded for **public**
  guides (from the public page and embeds) via `POST /api/guides/:id/events`.
  Owners see per-guide **view counts on the dashboard** and a 7-day **analytics
  panel** in the editor (`GET /api/guides/:id/stats`, owner-only).

## Video export

The editor **🎬 Export MP4** button renders the guide to an MP4:
`@napi-rs/canvas` draws each step's frames (screenshot + annotations + blur +
click ripple) with an eased Ken-Burns zoom toward the click point, `ffmpeg`
muxes each with its narration (or synthesizes/silence) and concatenates to a
`+faststart` H.264/AAC file. Branded cover and outro segments bookend the steps,
and any uploaded background-music track is looped and mixed in under the narration.

Rendering runs as a **background job** (see below): `POST /api/guides/:id/video`
enqueues and returns `{ jobId }` (202); the editor polls `GET /api/jobs/:id` for
progress and opens the video when it's done.

## Team workspaces

Guides belong to a **workspace**, not directly to a user. Every account gets a
**personal workspace** on signup; you can create **shared workspaces** and invite
teammates.

- **Roles** (ascending): `viewer` (watch guides) < `editor` (create/edit/delete,
  narrate, render, upload music) < `admin` (+ invite/remove members, change roles)
  < `owner` (+ grant owner; the last owner can't be removed). Authorization runs
  through `lib/workspace.ts` (`canAccessGuide(userId, guide, minRole)`), applied on
  every guide route and the editor.
- **Switcher** in the header changes the active workspace (stored in a cookie);
  the dashboard, new captures, and the extension all target it.
- **Invites**: existing users are added immediately; new emails get a one-time
  invite link (`/invite/:token`) to redeem after signing in — no email server
  required. Manage members at **/workspace**.
- Legacy guides created before workspaces are **lazily adopted** into their
  creator's personal workspace on first access, so nothing is orphaned.

## Storage & background jobs

- **Pluggable media storage** (`lib/storage`): `STORAGE_DRIVER=local` (default;
  writable `.media/` served via `/api/media/*`) or `STORAGE_DRIVER=s3` for any
  S3-compatible bucket (AWS S3, Cloudflare R2, MinIO). Guides always reference
  media by the stable `/api/media/...` URL, so switching drivers never rewrites
  stored data. The S3 SDK is an **optional dependency**, loaded only when enabled.
- **Job queue** (`lib/jobs`): slow MP4 renders run in a **DB-backed queue** drained
  by an **in-process worker** (single-flight, kicked on enqueue), so requests never
  block and job status survives a restart. Fit for a single long-lived Node server;
  for multi-node, run the same worker loop as a separate process against the shared
  DB — the queue API is unchanged.

## Deployment

A multi-stage **Dockerfile** builds the Next.js **standalone** output; the
entrypoint runs `prisma migrate deploy` on boot. For a step-by-step hosted
deploy on **Railway + Supabase** (Postgres + S3 media), see **[DEPLOY.md](./DEPLOY.md)**.

```bash
# SQLite, works out of the box (data + media on named volumes):
docker compose up --build            # → http://localhost:3000

# Postgres + S3 (production) — no manual schema edits:
docker compose -f docker-compose.postgres.yml up --build
```

The database schema is created on boot by the entrypoint (`migrate deploy` for
SQLite, `prisma db push` for Postgres/MySQL). Prisma pins the datasource provider
in the schema, so the Postgres image bakes it in at build time via the
`DATABASE_PROVIDER=postgresql` build arg (`scripts/set-db-provider.mjs`) — the
Postgres compose file sets this for you. Set `AUTH_SECRET` and `ENCRYPTION_KEY` to
long random values, mount a volume for `.media` (or use S3), and put a
TLS-terminating proxy in front.

**Local database:** `npm run db:migrate -w web` creates/updates the dev SQLite DB
and `npm run db:seed -w web` loads demo users, workspaces and guides
(`demo@example.com` / `password123`, plus a `teammate@example.com` member in the
shared "Acme Team" workspace).

## Tests

```bash
npm test        # shared unit tests + web data-layer & auth tests (51 total)
```

- `packages/shared` — caption heuristic, geometry math, zod schema round-trips.
- `web` — ownership-scoped guides data layer + auth primitives (password hashing,
  API-token hashing, session tokens) against a throwaway SQLite database.

The Chrome extension's live capture flow is verified separately with a headed
Chromium (Playwright persistent context under `xvfb`); it can't run in plain CI.

## Tech notes & tradeoffs

- **Persistence:** SQLite via Prisma in dev (Postgres in production — one-line
  provider change); `steps` (with base64 screenshots) stored as a JSON column.
  Generated media (narration, video) goes through the pluggable storage adapter —
  local disk by default, S3 in production.
- **Auth:** email+password (scrypt), HMAC-signed session cookies, and per-user
  API tokens (sha256-hashed at rest, shown once). No external auth dependency.
- **Annotations/zoom:** SVG overlay + `backdrop-filter` blur on screen; the PDF
  and video composite from the same normalized model (`lib/annotations/render.ts`,
  `lib/video/frame.ts`), so all outputs match playback. `html2canvas` is avoided.
- **Capture timing:** screenshots fire on `mousedown` (capture phase) so the
  frame is grabbed before a click navigates; `captureVisibleTab` is rate-limited,
  so captures are queued in the background worker.
```
