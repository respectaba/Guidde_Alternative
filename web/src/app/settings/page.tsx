import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { TokenManager } from "@/components/auth/TokenManager";
import { TtsSettings } from "@/components/auth/TtsSettings";
import { BrandKitSettings } from "@/components/auth/BrandKitSettings";
import { ConnectExtension } from "@/components/auth/ConnectExtension";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Voiceover keys and extension tokens for your account.</p>
        </div>
      </div>
      <BrandKitSettings />
      <TtsSettings />
      <h2 style={{ fontSize: 20, marginTop: 8 }}>Browser extension</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Connect the Chrome extension to capture guides on any website.
      </p>
      <ConnectExtension />
      <h3 style={{ fontSize: 16, marginTop: 8 }}>API tokens</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Manual connection — create a token to paste into the extension yourself.
      </p>
      <TokenManager />
    </main>
  );
}
