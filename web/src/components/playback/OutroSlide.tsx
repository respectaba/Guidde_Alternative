"use client";
import type { BrandKit } from "@guide/shared";

/** Closing slide: brand, a thank-you headline, and an optional CTA button. */
export function OutroSlide({
  brand,
  ctaText,
  ctaUrl,
}: {
  brand: BrandKit;
  ctaText?: string | null;
  ctaUrl?: string | null;
}) {
  const accent = brand.accentColor || "#6366f1";
  const hasCta = !!(ctaText && ctaText.trim());
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        background: `linear-gradient(135deg, ${shade(accent, -18)} 0%, ${shade(accent, -40)} 100%)`,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "6% 8%",
      }}
    >
      {brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo} alt="" style={{ maxHeight: "18%", maxWidth: "40%", marginBottom: "4%", objectFit: "contain" }} />
      ) : (
        brand.name && (
          <div style={{ fontSize: "clamp(14px,2.2vw,22px)", fontWeight: 700, opacity: 0.9, marginBottom: "3%" }}>
            {brand.name}
          </div>
        )
      )}
      <h1 style={{ margin: 0, fontSize: "clamp(20px,4vw,42px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
        Thanks for watching
      </h1>
      {hasCta &&
        (ctaUrl ? (
          <a
            href={normalizeUrl(ctaUrl)}
            target="_blank"
            rel="noreferrer"
            style={ctaStyle(accent)}
          >
            {ctaText}
          </a>
        ) : (
          <span style={ctaStyle(accent)}>{ctaText}</span>
        ))}
      <div style={{ position: "absolute", bottom: "5%", fontSize: "clamp(10px,1.3vw,13px)", opacity: 0.75 }}>
        {brand.name ? `${brand.name} · ` : ""}Made with Guideflow
      </div>
    </div>
  );
}

function ctaStyle(accent: string): React.CSSProperties {
  return {
    marginTop: "5%",
    display: "inline-block",
    background: "#fff",
    color: accent,
    fontWeight: 800,
    fontSize: "clamp(13px,1.9vw,18px)",
    padding: "0.7em 1.6em",
    borderRadius: 999,
    textDecoration: "none",
    boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
  };
}

function normalizeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function shade(hex: string, pct: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const amt = Math.round(2.55 * pct);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
