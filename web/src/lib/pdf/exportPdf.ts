/**
 * Client-side PDF export. Each step is rasterized from the normalized model via
 * renderStepToCanvas (so blur/annotations survive — html2canvas would not), then
 * placed on its own page with the caption. A cover page carries the title.
 */
import { jsPDF } from "jspdf";
import type { BrandKit, Guide } from "@guide/shared";
import { renderStepToCanvas } from "@/lib/annotations/render";

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? [99, 102, 241] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function exportGuideToPdf(guide: Guide, brand?: BrandKit): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const accent = brand?.accentColor ?? "#6366f1";
  const [ar_, ag_, ab_] = hexToRgb(accent);

  // ---- Branded cover ----
  if (guide.showCover !== false) {
    doc.setFillColor(ar_, ag_, ab_);
    doc.rect(0, 0, pageW, pageH, "F");

    let cursorY = pageH / 2 - 40;
    if (brand?.logo) {
      try {
        const img = await loadImage(brand.logo);
        const maxH = 70;
        const ar = img.width / img.height;
        const h = Math.min(maxH, img.height);
        const w = h * ar;
        doc.addImage(brand.logo, "PNG", margin, cursorY - h, w, h);
        cursorY += 10;
      } catch {
        /* ignore logo failures */
      }
    } else if (brand?.name) {
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(brand.name, margin, cursorY - 8);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    const titleLines = doc.splitTextToSize(guide.title, pageW - 2 * margin);
    doc.text(titleLines, margin, cursorY + 28);

    if (guide.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(15);
      const subLines = doc.splitTextToSize(guide.subtitle, pageW - 2 * margin);
      doc.text(subLines, margin, cursorY + 28 + titleLines.length * 34 + 6);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(
      `${brand?.name ? brand.name + " · " : ""}${guide.steps.length} step${
        guide.steps.length === 1 ? "" : "s"
      } · Made with Guideflow`,
      margin,
      pageH - margin,
    );
    doc.addPage();
  }

  // ---- Steps ----
  // With a cover we already added the blank page for step 0; without one, step 0
  // uses the document's initial page. Either way, add a page only from step 1 on.
  for (let i = 0; i < guide.steps.length; i++) {
    const step = guide.steps[i];
    if (i > 0) doc.addPage();

    // Step number + caption
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Step ${i + 1}`, margin, margin + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(55, 65, 81);
    const captionLines = doc.splitTextToSize(step.caption, pageW - 2 * margin);
    doc.text(captionLines, margin, margin + 28);

    const headerH = 28 + captionLines.length * 14 + 12;

    // Rendered screenshot
    const canvas = await renderStepToCanvas(step);
    const imgData = canvas.toDataURL("image/jpeg", 0.85);
    const availW = pageW - 2 * margin;
    const availH = pageH - margin - (margin + headerH);
    const ar = canvas.width / canvas.height;
    let w = availW;
    let h = w / ar;
    if (h > availH) {
      h = availH;
      w = h * ar;
    }
    const x = (pageW - w) / 2;
    const y = margin + headerH;
    doc.addImage(imgData, "JPEG", x, y, w, h);
  }

  const safeName =
    guide.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() ||
    "guide";
  doc.save(`${safeName}.pdf`);
}
