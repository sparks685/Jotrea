import { format } from "date-fns";
import { jsPDF } from "jspdf";
import type { DoseEntry, MedicationData, WeightEntry } from "@/types";
import { exportFiles } from "./featureGates";

export const VISIT_SUMMARY_DISCLAIMER =
  "This summary reflects user-recorded prescribed information only. Jotrea is a tracking and reminder tool and does not calculate, recommend, modify, or verify medication use or medical care.";

export function getVisitSummaryFilename(date: Date = new Date()): string {
  return `Jotrea-Visit-Summary-${format(date, "yyyy-MM-dd")}.pdf`;
}

export type VisitSummaryData = {
  trackerName: string;
  medication: MedicationData | null;
  doses: DoseEntry[];
  weights: WeightEntry[];
  units: string;
};

function textOrNone(value: string | undefined): string {
  return value?.trim() || "None recorded";
}

export function buildVisitSummaryPdf(data: VisitSummaryData, preparedAt: Date = new Date()): jsPDF {
  const doc = new jsPDF();
  const left = 18;
  let y = 22;
  const ensureSpace = (height: number) => {
    if (y + height > 278) {
      doc.addPage();
      y = 20;
    }
  };
  const write = (text: string, size = 10, gap = 7) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 174) as string[];
    const lineHeight = size * 0.42;
    for (const line of lines) {
      ensureSpace(lineHeight + gap);
      doc.text(line, left, y);
      y += lineHeight;
    }
    y += gap;
  };
  const heading = (title: string) => {
    ensureSpace(16);
    y += 3;
    doc.setTextColor(153, 91, 42);
    doc.setFont("helvetica", "bold");
    write(title, 13, 5);
    doc.setTextColor(35, 35, 35);
    doc.setFont("helvetica", "normal");
  };
  doc.setFillColor(212, 165, 116);
  doc.roundedRect(14, 12, 182, 28, 5, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Jotrea", left, 25);
  doc.setFontSize(11);
  doc.text("Provider Visit Summary", left, 34);
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "normal");
  y = 50;
  write(`Prepared ${format(preparedAt, "MMMM d, yyyy")} · Tracker: ${textOrNone(data.trackerName)}`, 10, 5);

  heading("Current prescribed medication");
  write(data.medication
    ? `${data.medication.brandName} · ${data.medication.dose} mg · ${data.medication.frequency}`
    : "None recorded");

  heading("Recorded doses");
  if (!data.doses.length) write("No dose entries recorded.");
  data.doses.forEach((dose) => {
    write(`${dose.date} ${dose.time} · ${dose.doseAmount} mg · ${dose.taken ? "Taken" : "Not taken"}${dose.site ? ` · ${dose.site}` : ""}${dose.notes ? ` · ${dose.notes}` : ""}`, 9, 4);
  });

  heading("Weight");
  if (!data.weights.length) write("No weight entries recorded.");
  data.weights.forEach((weight) => {
    write(`${weight.date} · ${weight.weight} ${data.units}${weight.notes ? ` · ${weight.notes}` : ""}`, 9, 4);
  });

  heading("Recorded symptoms");
  const symptomRows = data.doses.flatMap((dose) =>
    (dose.sideEffects ?? [])
      .map((symptom) => symptom.trim())
      .filter((symptom) => symptom && symptom.toLowerCase() !== "none")
      .map((symptom) => `${dose.date} · ${symptom}`)
  );
  if (!symptomRows.length) write("No symptoms recorded.", 9, 5);
  symptomRows.forEach((row) => write(row, 9, 4));

  heading("Tracker-only disclaimer");
  write(VISIT_SUMMARY_DISCLAIMER, 9, 0);
  return doc;
}

export async function exportVisitSummaryPdf(
  data: VisitSummaryData,
  preparedAt: Date = new Date()
): Promise<boolean> {
  const doc = buildVisitSummaryPdf(data, preparedAt);
  const dataUri = doc.output("datauristring");
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  return exportFiles([{
    filename: getVisitSummaryFilename(preparedAt),
    content: base64,
    encoding: "base64",
    mimeType: "application/pdf",
    contentType: "com.adobe.pdf",
  }]);
}