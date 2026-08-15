import type { DoseEntry, WeightEntry } from "@/types";

export const FREE_HISTORY_DAYS = 30;

export function isPremium(_subscription: string): boolean {
  return true; // free for launch — all features unlocked
}

export function getFreeHistoryCutoff(): Date {
  const d = new Date();
  d.setDate(d.getDate() - FREE_HISTORY_DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function filterForFreeTier<T extends { date: string }>(
  items: T[],
  subscription: string
): { visible: T[]; locked: T[] } {
  if (isPremium(subscription)) {
    return { visible: items, locked: [] };
  }
  const cutoff = getFreeHistoryCutoff();
  const visible = items.filter((i) => new Date(i.date) >= cutoff);
  const locked = items.filter((i) => new Date(i.date) < cutoff);
  return { visible, locked };
}

export function isCalendarMonthLocked(year: number, month: number, subscription: string): boolean {
  if (isPremium(subscription)) return false;
  const cutoff = getFreeHistoryCutoff();
  const lastDayOfMonth = new Date(year, month + 1, 0);
  return lastDayOfMonth < cutoff;
}

function escapeCsv(val: string | number | undefined): string {
  const s = val == null ? "" : String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function buildDoseCSV(doses: DoseEntry[]): string {
  const header = ["Date", "Time", "Dose (mg)", "Site", "Notes", "Taken"].join(",");
  const rows = [...doses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) =>
      [d.date, d.time, d.doseAmount, d.site, d.notes, d.taken ? "Yes" : "No"]
        .map(escapeCsv)
        .join(",")
    );
  return [header, ...rows].join("\n");
}

export function buildWeightCSV(weights: WeightEntry[], units: string): string {
  const header = ["Date", `Weight (${units})`, "Notes"].join(",");
  const rows = [...weights]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) =>
      [w.date, w.weight, (w as WeightEntry & { notes?: string }).notes ?? ""]
        .map(escapeCsv)
        .join(",")
    );
  return [header, ...rows].join("\n");
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export CSV files. On devices that support the Web Share API with files
 * (e.g. iOS webviews, where anchor-download is a silent no-op), open the
 * native share sheet. Otherwise fall back to regular browser downloads.
 * Returns true if the export was handed to the user (shared or downloaded).
 */
export async function exportCSVFiles(
  files: { filename: string; content: string }[]
): Promise<boolean> {
  const shareFiles = files.map(
    (f) => new File([f.content], f.filename, { type: "text/csv" })
  );
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  if (typeof nav.share === "function" && nav.canShare?.({ files: shareFiles })) {
    try {
      await nav.share({ files: shareFiles });
      return true;
    } catch (err) {
      // AbortError = user closed the share sheet; treat as handled.
      if (err instanceof DOMException && err.name === "AbortError") return true;
      // Otherwise fall through to download fallback.
    }
  }
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    setTimeout(() => downloadCSV(f.filename, f.content), i * 300);
  }
  return true;
}

