/**
 * Client-side PDF export. Each step is rasterized from the normalized model via
 * renderStepToCanvas (so blur/annotations survive — html2canvas would not), then
 * placed on its own page with the caption. A cover page carries the title.
 */
import { jsPDF } from "jspdf";
import type { Guide } from "@guide/shared";
import { renderStepToCanvas } from "@/lib/annotations/render";

export async function exportGuideToPdf(guide: Guide): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  // ---- Cover ----
  doc.setFillColor(11, 15, 26);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  const titleLines = doc.splitTextToSize(guide.title, pageW - 2 * margin);
  doc.text(titleLines, margin, pageH / 2 - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(154, 164, 184);
  doc.text(
    `${guide.steps.length} step${guide.steps.length === 1 ? "" : "s"} · Made with Guideflow`,
    margin,
    pageH / 2 + 24,
  );

  // ---- Steps ----
  for (let i = 0; i < guide.steps.length; i++) {
    const step = guide.steps[i];
    doc.addPage();

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
