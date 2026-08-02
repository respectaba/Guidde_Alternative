import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/LogoutButton";

export const metadata: Metadata = {
  title: "Guideflow — Step-by-step guide creator",
  description:
    "Capture, edit, narrate and share step-by-step how-to guides. An open Guidde alternative.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

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
              {user ? (
                <>
                  <Link href="/settings" className="btn ghost small">
                    API tokens
                  </Link>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {user.email}
                  </span>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/login" className="btn ghost small">
                    Log in
                  </Link>
                  <Link href="/signup" className="btn small primary">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
