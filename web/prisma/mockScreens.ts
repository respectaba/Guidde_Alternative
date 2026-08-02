/**
 * Generates fake "app screenshot" images as SVG data URLs for seed data, so the
 * editor / playback / PDF flows are fully demoable without ever running the
 * Chrome extension. Each screen mimics a simple SaaS UI at 1280x720.
 */

const W = 1280;
const H = 720;

interface ScreenOptions {
  title: string;
  /** Accent color for the header. */
  accent: string;
  /** Content rows drawn in the main panel. */
  rows: string[];
  /** Optional primary button label drawn bottom-right of the content. */
  primaryButton?: string;
  /** Highlight the primary button (draw a colored ring) for visual interest. */
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function mockScreen(opts: ScreenOptions): string {
  const rowsSvg = opts.rows
    .map((r, i) => {
      const y = 150 + i * 70;
      return `
        <rect x="300" y="${y}" width="900" height="52" rx="8" fill="#ffffff" stroke="#e5e7eb"/>
        <circle cx="330" cy="${y + 26}" r="10" fill="${opts.accent}" opacity="0.25"/>
        <text x="360" y="${y + 33}" font-family="Inter, Arial, sans-serif" font-size="18" fill="#374151">${esc(r)}</text>`;
    })
    .join("");

  const button = opts.primaryButton
    ? `
      <rect x="1010" y="620" width="190" height="56" rx="10" fill="${opts.accent}"/>
      <text x="1105" y="655" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="600" fill="#ffffff">${esc(
        opts.primaryButton,
      )}</text>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#f3f4f6"/>
    <!-- top bar -->
    <rect width="${W}" height="64" fill="${opts.accent}"/>
    <circle cx="34" cy="32" r="12" fill="#ffffff" opacity="0.9"/>
    <text x="60" y="40" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">${esc(
      opts.title,
    )}</text>
    <rect x="1120" y="18" width="130" height="28" rx="14" fill="#ffffff" opacity="0.25"/>
    <!-- sidebar -->
    <rect x="0" y="64" width="260" height="${H - 64}" fill="#111827"/>
    <text x="32" y="130" font-family="Inter, Arial, sans-serif" font-size="16" fill="#9ca3af">MENU</text>
    <text x="32" y="180" font-family="Inter, Arial, sans-serif" font-size="18" fill="#e5e7eb">Dashboard</text>
    <text x="32" y="230" font-family="Inter, Arial, sans-serif" font-size="18" fill="#e5e7eb">Projects</text>
    <text x="32" y="280" font-family="Inter, Arial, sans-serif" font-size="18" fill="#e5e7eb">Settings</text>
    <text x="32" y="330" font-family="Inter, Arial, sans-serif" font-size="18" fill="#e5e7eb">Team</text>
    <!-- content heading -->
    <text x="300" y="120" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700" fill="#111827">${esc(
      opts.title,
    )}</text>
    ${rowsSvg}
    ${button}
  </svg>`;

  const base64 = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
