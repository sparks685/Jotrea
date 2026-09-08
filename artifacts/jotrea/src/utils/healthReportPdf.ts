import { format } from "date-fns";
import { jsPDF } from "jspdf";
import type { DoseEntry, WeightEntry } from "@/types";
import { exportFiles, type ExportFile } from "./featureGates";

export type HealthReportData = {
  patientName: string;
  doses: DoseEntry[];
  weights: WeightEntry[];
  units: string;
};

type ReportDefinition = {
  type: "Dose History" | "Weight History" | "Symptom History";
  slug: "doses" | "weights" | "symptoms";
  orientation: "portrait" | "landscape";
  columns: { label: string; width: number }[];
  rows: string[][];
};

const DISCLAIMER =
  "This report reflects user-recorded prescribed information only. Jotrea is a tracking and reminder tool and does not calculate, recommend, modify, or verify medication use or medical care.";

function clean(value: string | number | undefined): string {
  const text = value == null ? "" : String(value).trim();
  return text || "Not recorded";
}

function definitions(data: HealthReportData): ReportDefinition[] {
  const doses = [...data.doses].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  );
  const weights = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const symptoms = doses.flatMap((dose) =>
    (dose.sideEffects ?? [])
      .map((symptom) => symptom.trim())
      .filter((symptom) => symptom && symptom.toLowerCase() !== "none")
      .map((symptom) => [
        dose.date,
        clean(dose.time),
        symptom,
        "Not recorded",
        clean(dose.notes),
      ])
  );

  return [
    {
      type: "Dose History",
      slug: "doses",
      orientation: "landscape",
      columns: [
        { label: "Date", width: 28 },
        { label: "Time", width: 22 },
        { label: "Dose (mg)", width: 28 },
        { label: "Site", width: 35 },
        { label: "Notes", width: 128 },
        { label: "Taken", width: 26 },
      ],
      rows: doses.map((dose) => [
        dose.date,
        clean(dose.time),
        String(dose.doseAmount),
        clean(dose.site),
        clean(dose.notes),
        dose.taken ? "Yes" : "No",
      ]),
    },
    {
      type: "Weight History",
      slug: "weights",
      orientation: "portrait",
      columns: [
        { label: "Date", width: 38 },
        { label: "Time", width: 38 },
        { label: `Weight (${data.units})`, width: 42 },
        { label: "Notes", width: 56 },
      ],
      rows: weights.map((weight) => [
        weight.date,
        "Not recorded",
        String(weight.weight),
        clean(weight.notes),
      ]),
    },
    {
      type: "Symptom History",
      slug: "symptoms",
      orientation: "landscape",
      columns: [
        { label: "Date", width: 32 },
        { label: "Time", width: 28 },
        { label: "Symptom", width: 55 },
        { label: "Severity", width: 48 },
        { label: "Notes", width: 104 },
      ],
      rows: symptoms,
    },
  ];
}

function buildReport(
  report: ReportDefinition,
  patientName: string,
  exportedAt: Date
): jsPDF {
  const doc = new jsPDF({ orientation: report.orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 15;
  const tableWidth = report.columns.reduce((sum, column) => sum + column.width, 0);
  let y = 0;
  let rowIndex = 0;

  const drawPageHeader = () => {
    doc.setFillColor(212, 165, 116);
    doc.rect(0, 0, pageWidth, 39, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Jotrea Health Report", left, 13);
    doc.setFontSize(18);
    doc.text(report.type, left, 23);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(`Exported on: ${format(exportedAt, "MMMM d, yyyy")}`, left, 32);
    const patient = clean(patientName);
    doc.text(`Patient: ${patient}`, pageWidth - left, 32, { align: "right" });
    y = 47;
  };

  const drawTableHeader = () => {
    doc.setDrawColor(190, 184, 176);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    let x = left;

    // Draw every background before drawing any text. Some PDF viewers,
    // including Apple Files, treat fill and text as one shared non-stroking
    // color state even though jsPDF tracks them separately.
    for (const column of report.columns) {
      doc.setFillColor(236, 229, 219);
      doc.rect(x, y, column.width, 12, "FD");
      x += column.width;
    }

    doc.setTextColor(26, 29, 61);
    x = left;
    for (const column of report.columns) {
      doc.text(column.label, x + 2, y + 8);
      x += column.width;
    }

    y += 12;
    doc.setFont("helvetica", "normal");
  };

  const addPage = () => {
    if (doc.getNumberOfPages() > 0 && y > 0) doc.addPage();
    drawPageHeader();
    drawTableHeader();
  };

  drawPageHeader();
  drawTableHeader();

  const rows = report.rows.length
    ? report.rows
    : [report.columns.map((_, index) => index === 0 ? "No records found" : "")];

  for (const row of rows) {
    doc.setFontSize(14);
    const wrapped = row.map((cell, index) =>
      doc.splitTextToSize(clean(cell), report.columns[index].width - 4) as string[]
    );
    const maxLines = Math.max(...wrapped.map((lines) => lines.length));
    const rowHeight = Math.max(14, maxLines * 6.3 + 6);
    if (y + rowHeight > pageHeight - 20) addPage();

    const rowShade = rowIndex % 2 === 0 ? 250 : 242;
    doc.setDrawColor(210, 210, 210);
    let x = left;

    wrapped.forEach((_, index) => {
      const width = report.columns[index].width;
      doc.setFillColor(rowShade, rowShade, rowShade);
      doc.rect(x, y, width, rowHeight, "FD");
      x += width;
    });

    doc.setTextColor(35, 35, 35);
    x = left;
    wrapped.forEach((lines, index) => {
      const width = report.columns[index].width;
      doc.text(lines, x + 2, y + 7);
      x += width;
    });
    y += rowHeight;
    rowIndex += 1;
  }

  if (y + 24 > pageHeight - 20) {
    doc.addPage();
    drawPageHeader();
  }
  doc.setFontSize(14);
  doc.setTextColor(75, 75, 75);
  const disclaimerLines = doc.splitTextToSize(DISCLAIMER, tableWidth) as string[];
  doc.text(disclaimerLines, left, y + 10);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(75, 75, 75);
    doc.text("Generated by Jotrea", left, pageHeight - 8);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - left, pageHeight - 8, { align: "right" });
  }

  return doc;
}

export function getHealthReportFilenames(exportedAt: Date = new Date()) {
  const timestamp = format(exportedAt, "yyyy-MM-dd-HHmmss");
  return {
    doses: `Jotrea-Dose-History-${timestamp}.pdf`,
    weights: `Jotrea-Weight-History-${timestamp}.pdf`,
    symptoms: `Jotrea-Symptom-History-${timestamp}.pdf`,
  } as const;
}

export function buildHealthReportPdfs(data: HealthReportData, exportedAt: Date = new Date()) {
  return definitions(data).map((report) => ({
    slug: report.slug,
    doc: buildReport(report, data.patientName, exportedAt),
  }));
}

export async function exportHealthReportPdfs(
  data: HealthReportData,
  exportedAt: Date = new Date()
): Promise<boolean> {
  const filenames = getHealthReportFilenames(exportedAt);
  const files: ExportFile[] = buildHealthReportPdfs(data, exportedAt).map(({ slug, doc }) => {
    const dataUri = doc.output("datauristring");
    return {
      filename: filenames[slug],
      content: dataUri.slice(dataUri.indexOf(",") + 1),
      encoding: "base64",
      mimeType: "application/pdf",
      contentType: "com.adobe.pdf",
    };
  });
  return exportFiles(files);
}