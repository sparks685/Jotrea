import type { DoseEntry, WeightEntry } from "@/types";

export const FREE_HISTORY_DAYS = 30;

export function isPremium(subscription: string): boolean {
  return subscription === "premium";
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

export function scheduleNextDoseNotification(
  nextDoseDate: string,
  medicationName: string,
  dose: number,
  unit: string,
  advanceHours: number
): void {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const doseTime = new Date(nextDoseDate + "T09:00:00");
  const notifTime = new Date(doseTime.getTime() - advanceHours * 60 * 60 * 1000);
  const delay = notifTime.getTime() - Date.now();
  if (delay <= 0 || delay > 7 * 24 * 60 * 60 * 1000) return;
  setTimeout(() => {
    new Notification("💉 Jotrea — Dose Reminder", {
      body: `${medicationName} ${dose}${unit} is due ${advanceHours >= 24 ? "tomorrow" : `in ${advanceHours} hour${advanceHours !== 1 ? "s" : ""}`}`,
      icon: "/icon-192x192.png",
      tag: "jotrea-dose-reminder",
    });
  }, delay);
}
