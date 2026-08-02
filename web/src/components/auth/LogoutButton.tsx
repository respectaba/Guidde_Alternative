"use client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };
  return (
    <button className="btn ghost small" onClick={logout}>
      Log out
    </button>
  );
}
