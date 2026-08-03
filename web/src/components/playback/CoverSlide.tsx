"use client";
import type { BrandKit } from "@guide/shared";

/** Title card shown as the first slide of a guide, styled by the brand kit. */
export function CoverSlide({
  title,
  subtitle,
  brand,
}: {
  title: string;
  subtitle?: string | null;
  brand: BrandKit;
}) {
  const accent = brand.accentColor || "#6366f1";
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        background: `linear-gradient(135deg, ${accent} 0%, ${shade(accent, -28)} 100%)`,
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
        <img
          src={brand.logo}
          alt=""
          style={{ maxHeight: "22%", maxWidth: "45%", marginBottom: "4%", objectFit: "contain" }}
        />
      ) : (
        brand.name && (
          <div style={{ fontSize: "clamp(14px,2.2vw,22px)", fontWeight: 700, opacity: 0.9, marginBottom: "3%" }}>
            {brand.name}
          </div>
        )
      )}
      <h1 style={{ margin: 0, fontSize: "clamp(22px,4.6vw,48px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ margin: "3% 0 0", fontSize: "clamp(13px,2vw,20px)", opacity: 0.92, maxWidth: "80%" }}>
          {subtitle}
        </p>
      )}
      <div style={{ position: "absolute", bottom: "5%", fontSize: "clamp(10px,1.3vw,13px)", opacity: 0.75 }}>
        {brand.name ? `${brand.name} · ` : ""}Made with Guideflow
      </div>
    </div>
  );
}

/** Darken/lighten a hex color by percent (-100..100). */
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
