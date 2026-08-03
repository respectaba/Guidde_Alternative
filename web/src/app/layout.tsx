import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspaceId, listWorkspaces } from "@/lib/workspace";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";

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
  // Chromeless for /embed so the player sits flush inside an iframe.
  const chromeless = (headers().get("x-pathname") ?? "").startsWith("/embed");
  if (chromeless) {
    return (
      <html lang="en">
        <body style={{ background: "transparent" }}>{children}</body>
      </html>
    );
  }

  const user = await getSessionUser();
  let workspaces: Awaited<ReturnType<typeof listWorkspaces>> = [];
  let activeWorkspaceId = "";
  if (user) {
    [workspaces, activeWorkspaceId] = await Promise.all([
      listWorkspaces(user.id),
      getActiveWorkspaceId(user.id, user.email),
    ]);
  }

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
                  <WorkspaceSwitcher
                    initialWorkspaces={workspaces}
                    initialActiveId={activeWorkspaceId}
                  />
                  <Link href="/settings" className="btn ghost small">
                    Settings
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
