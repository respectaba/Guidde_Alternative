import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { TokenManager } from "@/components/auth/TokenManager";
import { TtsSettings } from "@/components/auth/TtsSettings";

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
      <TtsSettings />
      <h2 style={{ fontSize: 20, marginTop: 8 }}>API tokens</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Connect the Chrome extension to your account.
      </p>
      <TokenManager />
    </main>
  );
}
