import type { WeightEntry } from "@/types";
import { LBS_PER_KG, type WeightUnit } from "@/utils/weightUnits";
import { orderWeightEntries } from "@/utils/weightEntries";

export const MAX_WEIGHT_LBS = 1500;
export const MAX_WEIGHT_KG_DISPLAY = Math.round(MAX_WEIGHT_LBS / LBS_PER_KG * 10) / 10;

/** Picker text is rounded for readability; the underlying value is never rounded. */
export function metricHeightLabel(cm: number): string {
  return `${Number.isInteger(cm) ? cm : `≈ ${Math.round(cm)}`} cm`;
}

export function weightError(value: number | string, unit: WeightUnit): string | null {
  const n = typeof value === "string" ? Number(value) : value;
  if ((typeof value === "string" && !value.trim()) || !Number.isFinite(n) || n <= 0) {
    return "Enter a weight greater than 0.";
  }
  // A 1500 lb entry is displayed as 680.4 kg after unit conversion. Permit
  // that single display-tenth so a valid boundary weigh-in remains editable.
  if (n > (unit === "kg" ? MAX_WEIGHT_KG_DISPLAY : MAX_WEIGHT_LBS)) {
    return `Weight must be at most ${unit === "kg" ? `${MAX_WEIGHT_KG_DISPLAY} kg (approximately 1500 lbs)` : "1500 lbs"}.`;
  }
  return null;
}

export function validWeightEntries(entries: WeightEntry[], unit: WeightUnit): WeightEntry[] {
  return entries.filter(entry => {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || typeof entry.date !== "string" ||
      typeof entry.weight !== "number" || weightError(entry.weight, unit)) return false;
    return validWeightDate(entry.date);
  });
}

export function validWeightDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** The preceding entry by date; storage order breaks ties on the same day. */
export function previousWeightEntry(entries: WeightEntry[], date: string, unit: WeightUnit, editingId?: string): WeightEntry | null {
  const ordered = orderWeightEntries(validWeightEntries(entries, unit).filter(entry => entry.id !== editingId));
  return [...ordered].reverse().find(entry => entry.date <= date) ?? null;
}

export function needsWeightConfirmation(entries: WeightEntry[], date: string, weight: number, unit: WeightUnit, editingId?: string): boolean {
  const previous = previousWeightEntry(entries, date, unit, editingId);
  return !!previous && Math.abs(weight - previous.weight) / previous.weight >= 0.1 - 1e-12;
}

/** Valid calendar birthday; null indicates a future or impossible date. */
export function birthdayAge(value: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > today) return null;
  return today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0);
}