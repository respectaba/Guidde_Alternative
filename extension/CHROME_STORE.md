# Publishing the Guideflow extension to the Chrome Web Store

Publishing gives you (and your users) a one-click **"Add to Chrome"** install
instead of the developer/unpacked flow. It's a one-time setup.

## What you need
- A Google account.
- A **one-time $5** Chrome Web Store developer registration fee.
- The packaged extension zip: run `npm run build -w extension`, then zip the
  **contents** of `extension/dist` (the zip you were sent already is this).

## Steps
1. Go to the **Chrome Web Store Developer Dashboard**:
   https://chrome.google.com/webstore/devconsole
2. Register as a developer (pay the one-time $5 fee) if you haven't.
3. Click **Add new item** → upload the **zip of `extension/dist`**.
4. Fill in the store listing:
   - **Name / summary** — already in the manifest ("Guideflow — Guide Recorder").
   - **Description** — what it does (records click-by-click guides and sends them
     to your Guideflow app).
   - **Icon** — 128×128 is bundled (`icons/icon128.png`); the store may also ask
     for a larger 128px store icon and at least one **screenshot** (1280×800 or
     640×400). Take a screenshot of the popup or a captured guide.
   - **Category** — Productivity. **Language** — English.
   - **Privacy** — a single-purpose justification (screen capture for guide
     creation) and a privacy policy URL if you collect anything. This extension
     only sends captures to the Web-app URL the user configures.
5. Set **Visibility**: **Unlisted** (share via link) is easiest for a private
   team; **Public** goes through fuller review.
6. Submit for review. Approval typically takes a few hours to a few days.

## After it's published
- Users click **Add to Chrome**, then open Guideflow → **Settings → Connect
  extension** for one-click setup (no token pasting).
- To ship an update: bump `version` in `extension/manifest.json`, rebuild, and
  upload the new zip in the dashboard.

## Notes
- The extension talks only to the **Web app URL** the user sets (or that the
  "Connect extension" button configures) — no hardcoded backend.
- `host_permissions: <all_urls>` is required so it can capture on any site; be
  ready to justify this in the review ("capture guides on arbitrary websites").
