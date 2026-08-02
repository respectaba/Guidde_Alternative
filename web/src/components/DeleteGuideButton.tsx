"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteGuideButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onDelete = async () => {
    if (!confirm("Delete this guide? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/guides/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else alert("Failed to delete guide.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn danger small" onClick={onDelete} disabled={busy}>
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
