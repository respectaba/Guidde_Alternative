# Deploying Guideflow (Railway + Supabase)

This deploys the app on **Railway** (runs the Next.js server *and* the background
MP4 render worker in one always-on container) with **Supabase** for the
**Postgres database** and **S3-compatible media storage**.

Why this split: the video renderer is a long-running, in-process worker, so the
app needs a persistent container (Railway) rather than serverless. Supabase
provides both the database and object storage the app needs.

```
Browser ─▶ Railway (Next.js app + render worker)
                ├─▶ Supabase Postgres   (users, guides, workspaces, jobs)
                └─▶ Supabase Storage/S3 (narration audio + exported video)
```

Everything on the code side is already wired: a Dockerfile (Next standalone),
an entrypoint that creates the DB schema on boot, a pluggable S3 storage driver,
and a DB-backed job queue. You only need to set environment variables.

---

## Prerequisites

- A GitHub repo Railway can access (this repo).
- A Supabase project (you've created this).
- Two random secrets. Generate them locally:
  ```bash
  openssl rand -base64 32   # AUTH_SECRET
  openssl rand -base64 32   # ENCRYPTION_KEY
  ```
  Keep these safe — rotating `ENCRYPTION_KEY` invalidates stored per-user TTS keys,
  and rotating `AUTH_SECRET` logs everyone out.

---

## Part 1 — Supabase

### 1a. Database connection string

1. Supabase dashboard → your project → **Connect** (top bar).
2. Choose the **Session pooler** connection (host looks like
   `aws-0-<region>.pooler.supabase.com`, port **5432**). Use this rather than the
   Transaction pooler (6543): the app runs schema setup (`prisma db push`) on
   boot, which needs a session-mode connection, and the Session pooler is
   IPv4-friendly for Railway.
3. Copy the URI. It looks like:
   ```
   postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
4. Append SSL: add `?sslmode=require` to the end. Final form:
   ```
   postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
   ```

### 1b. Storage bucket + S3 keys

1. Supabase dashboard → **Storage** → **New bucket** → name it e.g. `guideflow`
   (leave it **private** — media is served through the app's `/api/media` route,
   so the bucket doesn't need public access).
2. Storage → **Settings** → **S3 Connection**:
   - Note the **Endpoint**, e.g. `https://<project-ref>.storage.supabase.co/storage/v1/s3`
   - Note the **Region**, e.g. `us-east-1`
   - Click **New access key** and copy the **Access key ID** and **Secret access key**.

---

## Part 2 — Railway

1. Go to **https://railway.com/** → sign in with GitHub → **New Project** →
   **Deploy from GitHub repo** → pick this repo (`respectaba/guidde_alternative`).
2. Railway detects the root **Dockerfile** and uses it. If it asks, keep the
   **root directory** as the repo root (the Dockerfile builds the monorepo).
3. Open the service → **Variables** → add all of these:

   | Variable | Value |
   |---|---|
   | `DATABASE_PROVIDER` | `postgresql` |
   | `DATABASE_URL` | the Supabase URI from step 1a (with `?sslmode=require`) |
   | `AUTH_SECRET` | your first generated secret |
   | `ENCRYPTION_KEY` | your second generated secret |
   | `STORAGE_DRIVER` | `s3` |
   | `S3_BUCKET` | `guideflow` (your bucket name) |
   | `S3_REGION` | your Supabase storage region, e.g. `us-east-1` |
   | `S3_ENDPOINT` | `https://<ref>.storage.supabase.co/storage/v1/s3` |
   | `AWS_ACCESS_KEY_ID` | Supabase storage access key ID |
   | `AWS_SECRET_ACCESS_KEY` | Supabase storage secret access key |

   `DATABASE_PROVIDER` is read at **build time** (the Dockerfile declares
   `ARG DATABASE_PROVIDER`), so Railway bakes the Postgres provider into the
   Prisma client. Set it *before* the first build; if you added it afterward,
   trigger a **redeploy** so the build picks it up.

4. **Networking** → **Generate Domain** to get a public URL (or attach your own).
   Railway injects `PORT` automatically; the app binds it — no port config needed.
5. Deploy. On first boot the entrypoint runs `prisma db push`, which creates all
   tables in your Supabase database.

---

## Part 3 — First-run setup & verification

1. Open the Railway URL. You should see the login page.
2. **Create your account** at `/signup` — this also creates your personal
   workspace.
3. Optional — load demo content (users, workspaces, sample guides). From your
   machine, against the same Supabase URL:
   ```bash
   cd web
   DATABASE_URL="postgresql://…pooler.supabase.com:5432/postgres?sslmode=require" \
   DATABASE_PROVIDER=postgresql \
     npx prisma db seed
   ```
   (Seeds `demo@example.com` / `password123`, a teammate, and an "Acme Team"
   shared workspace.)
4. Smoke test:
   - Sign in, create a guide (or import one), open the editor.
   - Click **🎬 Export MP4** — it enqueues a job; the worker renders it and the
     video opens when done. This confirms the DB, the job queue, and S3 storage
     are all wired.
   - In Supabase → **Table editor** you'll see rows in `User`, `Workspace`,
     `Guide`, `Job`; in **Storage** you'll see the rendered file under the bucket.

---

## Environment variables reference

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_PROVIDER` | build | `postgresql` here; default `sqlite`. Read at build time. |
| `DATABASE_URL` | yes | Postgres connection string (Session pooler, `?sslmode=require`). |
| `AUTH_SECRET` | yes | Signs session cookies. Long random string. |
| `ENCRYPTION_KEY` | yes | Encrypts per-user TTS keys at rest (AES-256-GCM). |
| `STORAGE_DRIVER` | yes | `s3` for production; `local` uses a disk volume. |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` | if s3 | Supabase Storage S3 settings. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | if s3 | Supabase storage keys. |
| `AI_PROVIDER` / `ANTHROPIC_API_KEY` | no | Optional richer captions via Claude. |
| `TTS_PROVIDER` / `TTS_API_KEY` | no | Operator-fallback neural voiceover; users can also BYO keys in Settings. |

---

## Troubleshooting

- **Build succeeds but requests time out / 502.** Ensure `DATABASE_PROVIDER=postgresql`
  was set *before* the build. If it was added later, redeploy so the Prisma client
  is generated for Postgres (a client built for SQLite refuses a `postgresql://` URL).
- **`db push` errors about prepared statements / DDL.** You're on the Transaction
  pooler (port 6543). Switch `DATABASE_URL` to the **Session pooler** (5432).
- **TLS/self-signed errors to the DB.** Confirm `?sslmode=require` is on the URL.
- **Media 404 / upload fails.** Check the four `S3_*`/`AWS_*` values; the endpoint
  must be the full `…/storage/v1/s3` path. The bucket can stay private (served via
  `/api/media`).
- **Renders never finish.** The worker runs inside the web container, so keep the
  service always-on (don't scale to zero). Logs show `Provisioning schema…` on boot
  and job progress during renders.

---

## Alternative: all-on-Railway (no Supabase)

Railway also offers managed Postgres and volumes, so you can run everything on one
platform:

- Add a **PostgreSQL** database in the Railway project; set `DATABASE_URL` to the
  reference it provides and `DATABASE_PROVIDER=postgresql`.
- For media, either add a **Volume** mounted at `/app/web/.media` and set
  `STORAGE_DRIVER=local`, or keep `STORAGE_DRIVER=s3` pointing at any S3 bucket.

Everything else (variables, build, verification) is identical.

---

## Scaling note

The MP4 render worker runs inside the web container (single always-on process),
which is ideal for one Railway service. To scale the web tier horizontally later,
run the worker as its own Railway service against the same `DATABASE_URL` (the job
queue is already DB-backed) and disable the inline worker on the web tier — ask
and this can be split out with a dedicated `npm run worker` entrypoint.
