import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guideflow — Step-by-step guide creator",
  description:
    "Capture, edit, narrate and share step-by-step how-to guides. An open Guidde alternative.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <nav className="nav">
            <Link href="/" className="brand">
              <span className="logo">▶</span>
              Guideflow
            </Link>
            <div className="row">
              <Link href="/import" className="btn ghost small">
                Import capture
              </Link>
              <a
                href="https://github.com"
                className="btn small"
                target="_blank"
                rel="noreferrer"
              >
                Get the extension
              </a>
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
