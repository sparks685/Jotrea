import type { DailyTargetStore } from "@/types/dailyTargets";
import {
  DAILY_TARGETS_KEY,
  LEGACY_CHECKIN_KEY,
  mergeLegacyCheckin,
  sanitizeStore,
} from "./dailyTargets";

/** Read at export time, not at Settings render time. Corrupt records are sanitized. */
export function readDailyTargetsForExport(storage: Pick<Storage, "getItem"> = localStorage): DailyTargetStore {
  const parse = (key: string): unknown => {
    const text = storage.getItem(key);
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Cannot export daily targets: ${key} contains invalid JSON.`);
    }
  };
  return mergeLegacyCheckin(sanitizeStore(parse(DAILY_TARGETS_KEY)), parse(LEGACY_CHECKIN_KEY));
}

function csvCell(value: string | number): string {
  let text = String(value);
  // Quoting is not enough to stop spreadsheet formula execution.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Individual entries retain their recorded units; legacy flags never imply an amount. */
export function buildDailyTargetsCSV(value: unknown): string {
  const store = sanitizeStore(value);
  const rows: (string | number)[][] = [
    ["Date", "Target", "Logged At", "Amount", "Unit", "Source", "Entry ID"],
  ];
  for (const date of Object.keys(store.days).sort()) {
    const day = store.days[date];
    for (const [target, entries, unit] of [
      ["water", day.water, "mL"],
      ["protein", day.protein, "g"],
    ] as const) {
      for (const entry of entries) {
        rows.push([date, target, entry.loggedAt, entry.amount, unit, "Recorded entry", entry.id]);
      }
    }
    if (day.steps !== null) rows.push([date, "steps", "", day.steps, "steps", "Daily total", ""]);
    for (const target of ["water", "protein", "steps"] as const) {
      if (day.legacy?.[target]) {
        rows.push([date, target, "", "", "", "Legacy checkmark (completion only; amount unknown)", ""]);
      }
    }
  }
  return rows.map(row => row.map(csvCell).join(",")).join("\n");
}