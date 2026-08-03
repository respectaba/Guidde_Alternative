import Link from "next/link";

/**
 * Public marketing homepage shown at "/" to logged-out visitors. Logged-in
 * users get the dashboard instead (see app/page.tsx). Server component — no
 * client JS needed; all CTAs are plain links.
 */
export function LandingPage({ demoSlug }: { demoSlug?: string | null }) {
  return (
    <div className="landing">
      {/* Hero */}
      <section className="lp-hero">
        <span className="lp-eyebrow">Guideflow</span>
        <h1>
          Turn any workflow into a<br />
          <span className="lp-grad">step-by-step guide</span> — automatically.
        </h1>
        <p className="lp-sub">
          Capture your screen as you click, and Guideflow builds a narrated,
          annotated walkthrough you can share, embed, or export to PDF and video —
          in minutes, not hours.
        </p>
        <div className="lp-cta-row">
          <Link href="/signup" className="btn primary lp-cta">
            Get started free
          </Link>
          {demoSlug ? (
            <Link href={`/guide/${demoSlug}`} className="btn ghost lp-cta">
              ▶ Watch a live demo
            </Link>
          ) : (
            <Link href="/login" className="btn ghost lp-cta">
              Log in
            </Link>
          )}
        </div>
        <p className="lp-note">No credit card required · Free to start</p>
      </section>

      {/* Features */}
      <section className="lp-section">
        <h2 className="lp-h2">Everything you need to document how things work</h2>
        <div className="lp-grid">
          {FEATURES.map((f) => (
            <div className="lp-card" key={f.title}>
              <div className="lp-icon" aria-hidden>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="lp-section lp-steps-wrap">
        <h2 className="lp-h2">From clicks to a polished guide in three steps</h2>
        <div className="lp-steps">
          {STEPS.map((s, i) => (
            <div className="lp-step" key={s.title}>
              <div className="lp-step-num">{i + 1}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-final">
        <h2>Ready to make your first guide?</h2>
        <p>Create an account and publish a shareable walkthrough today.</p>
        <div className="lp-cta-row">
          <Link href="/signup" className="btn primary lp-cta">
            Get started free
          </Link>
          <Link href="/login" className="btn ghost lp-cta">
            Log in
          </Link>
        </div>
      </section>

      <footer className="lp-footer">
        <span>Guideflow — an open step-by-step guide creator</span>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: "🎬",
    title: "Capture or import",
    body: "The browser extension records each click into a screenshot + step, or import a capture — no manual screenshotting.",
  },
  {
    icon: "✏️",
    title: "Edit & annotate",
    body: "Highlights, arrows, and text callouts, plus blur to hide sensitive data — all on a clean editor canvas.",
  },
  {
    icon: "🔊",
    title: "AI voiceover & captions",
    body: "Auto-written step captions and neural voiceover (bring your own key, or use the built-in voices).",
  },
  {
    icon: "▶️",
    title: "Cinematic playback",
    body: "Guides play back like a video — zoom-to-click, click ripples, and auto-advancing narration.",
  },
  {
    icon: "🔗",
    title: "Share & embed",
    body: "Public links and a chromeless embeddable player, with view and completion analytics.",
  },
  {
    icon: "📄",
    title: "Export anywhere",
    body: "One click to a branded PDF or an MP4 with cover, outro, call-to-action, and background music.",
  },
  {
    icon: "👥",
    title: "Team workspaces",
    body: "Invite teammates with viewer / editor / admin roles and collaborate in shared workspaces.",
  },
  {
    icon: "🎨",
    title: "Brand kit",
    body: "Your logo and accent color applied across cover slides, exports, and the player.",
  },
];

const STEPS = [
  {
    title: "Capture",
    body: "Record a workflow with the extension (or import one). Each click becomes a screenshot and a step automatically.",
  },
  {
    title: "Polish",
    body: "Tweak captions, add annotations, blur secrets, generate voiceover, and apply your brand — in the editor.",
  },
  {
    title: "Share",
    body: "Publish a link, embed it on your site, or export to PDF/MP4. Track views and completions as people watch.",
  },
];
