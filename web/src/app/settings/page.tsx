import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { TokenManager } from "@/components/auth/TokenManager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>API tokens</h1>
          <p className="muted">Connect the Chrome extension to your account.</p>
        </div>
      </div>
      <TokenManager />
    </main>
  );
}
