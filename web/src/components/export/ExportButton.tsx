"use client";
import { useState } from "react";
import type { BrandKit, Guide } from "@guide/shared";
import { exportGuideToPdf } from "@/lib/pdf/exportPdf";

/** Renders the guide to a downloadable PDF entirely in the browser. */
export function ExportButton({ guide, brand }: { guide: Guide; brand?: BrandKit }) {
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    try {
      await exportGuideToPdf(guide, brand);
    } catch (e) {
      console.error(e);
      alert("PDF export failed. See console for details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn small" onClick={onExport} disabled={busy}>
      {busy ? "Exporting…" : "⬇ Export PDF"}
    </button>
  );
}
