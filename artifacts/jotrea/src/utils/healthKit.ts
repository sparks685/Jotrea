import { Health, type AuthorizationOptions } from "@capgo/capacitor-health";
import type { WeightEntry } from "@/types";

export type HealthKitAuthorization = "authorized" | "denied" | "notDetermined" | "unavailable";

export interface HealthKitWeightSample {
  value: number;
  unit: "kg" | "lb";
  startDate: string;
  endDate: string;
  sourceName?: string;
}

export type HealthKitAvailability = "checking" | "available" | "unavailable";

const WEIGHT_SCOPE: AuthorizationOptions = { read: ["weight"], write: ["weight"] };
export const HEALTHKIT_WEIGHT_EXPORT_STATE_KEY = "jotrea_healthkit_weight_export_fingerprints";

export interface HealthKitWeightExportResult {
  exported: number;
  skipped: number;
  failed: number;
}

type HealthKitWeightExportState = Record<string, string>;

function authorizationFromStatus(status: {
  readAuthorized: readonly string[];
  readDenied: readonly string[];
  writeAuthorized: readonly string[];
  writeDenied: readonly string[];
}): HealthKitAuthorization {
  if (status.readDenied.includes("weight") || status.writeDenied.includes("weight")) {
    return "denied";
  }
  if (status.readAuthorized.includes("weight") && status.writeAuthorized.includes("weight")) {
    return "authorized";
  }
  return "notDetermined";
}

/** HealthKit is intentionally unavailable on the web and non-iOS platforms. */
export async function isHealthKitAvailable(): Promise<boolean> {
  try {
    return (await Health.isAvailable()).available;
  } catch {
    return false;
  }
}

export async function requestHealthKitAuthorization(): Promise<HealthKitAuthorization> {
  if (!(await isHealthKitAvailable())) return "unavailable";
  try {
    return authorizationFromStatus(await Health.requestAuthorization(WEIGHT_SCOPE));
  } catch (error) {
    if (/denied|not authorized/i.test(error instanceof Error ? error.message : String(error))) {
      return "denied";
    }
    throw error;
  }
}

/** Checks existing access without showing the system authorization prompt. */
export async function getHealthKitAuthorizationStatus(): Promise<HealthKitAuthorization> {
  if (!(await isHealthKitAvailable())) return "unavailable";
  try {
    return authorizationFromStatus(await Health.checkAuthorization(WEIGHT_SCOPE));
  } catch (error) {
    if (/denied|not authorized/i.test(error instanceof Error ? error.message : String(error))) {
      return "denied";
    }
    throw error;
  }
}

function localDate(isoDate: string): string | null {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function convertWeight(value: number, from: "kg" | "lb", to: "kg" | "lbs"): number {
  const inTargetUnits = to === "kg" ? (from === "kg" ? value : value / 2.20462) : from === "lb" ? value : value * 2.20462;
  return Number(inTargetUnits.toFixed(1));
}

/**
 * Builds daily Jotrea entries from Apple Health samples. Jotrea records one
 * weight per calendar day, so a local entry (or an earlier Health sample) for
 * that day wins; this makes repeated imports idempotent.
 */
export function mergeHealthKitWeights(
  existing: WeightEntry[],
  samples: HealthKitWeightSample[],
  units: "kg" | "lbs"
): WeightEntry[] {
  const occupiedDates = new Set(existing.map((entry) => entry.date));
  const imported: WeightEntry[] = [];
  for (const sample of samples) {
    const date = localDate(sample.startDate);
    if (!date || occupiedDates.has(date) || !Number.isFinite(sample.value) || sample.value <= 0) continue;
    const weight = convertWeight(sample.value, sample.unit, units);
    imported.push({
      id: `healthkit-${date}-${weight}`,
      date,
      weight,
      notes: "Imported from Apple Health",
    });
    occupiedDates.add(date);
  }
  return [...existing, ...imported].sort((a, b) => a.date.localeCompare(b.date));
}

export async function readHealthKitWeights(
  startDate: Date,
  endDate: Date = new Date(),
  limit = 500
): Promise<HealthKitWeightSample[]> {
  if (!(await isHealthKitAvailable())) return [];
  const { samples } = await Health.readSamples({
    dataType: "weight",
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    limit,
    ascending: true,
  });
  return samples
    .map((sample) => ({
      value: sample.value,
      unit: "kg" as const,
      startDate: sample.startDate,
      endDate: sample.endDate,
      sourceName: sample.sourceName,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function writeHealthKitWeight(
  value: number,
  unit: "kg" | "lb",
  date: Date = new Date()
): Promise<boolean> {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Weight must be a positive number");
  }
  if (!(await isHealthKitAvailable())) return false;
  const kilograms = unit === "kg" ? value : value / 2.20462;
  const timestamp = date.toISOString();
  await Health.saveSample({
    dataType: "weight",
    value: kilograms,
    unit: "kilogram",
    startDate: timestamp,
    endDate: timestamp,
  });
  return true;
}

function exportStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Returns only valid persisted export fingerprints, including after corrupt storage. */
export function getHealthKitWeightExportState(): HealthKitWeightExportState {
  try {
    const raw = exportStorage()?.getItem(HEALTHKIT_WEIGHT_EXPORT_STATE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const state: HealthKitWeightExportState = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") state[key] = value;
    }
    return state;
  } catch {
    return {};
  }
}

function saveHealthKitWeightExportState(state: HealthKitWeightExportState): void {
  try {
    exportStorage()?.setItem(HEALTHKIT_WEIGHT_EXPORT_STATE_KEY, JSON.stringify(state));
  } catch {
    // A successful HealthKit write remains valid even when browser storage is unavailable.
  }
}

/**
 * Uses canonical kilograms so switching the app's display unit does not create
 * a duplicate Apple Health sample for an unchanged tracker entry.
 */
export function healthKitWeightExportFingerprint(entry: WeightEntry, units: "kg" | "lbs"): string {
  const kilograms = units === "kg" ? entry.weight : entry.weight / 2.20462;
  return `${entry.date}:${Number(kilograms.toFixed(6))}`;
}

/**
 * Exports only entries that have changed since their last successful export.
 * This is called solely from the explicit Apple Health export action.
 */
export async function exportHealthKitWeights(
  weights: WeightEntry[],
  units: "kg" | "lbs"
): Promise<HealthKitWeightExportResult> {
  const exportState = getHealthKitWeightExportState();
  const result: HealthKitWeightExportResult = { exported: 0, skipped: 0, failed: 0 };

  for (const entry of weights) {
    const fingerprint = healthKitWeightExportFingerprint(entry, units);
    if (exportState[entry.id] === fingerprint) {
      result.skipped++;
      continue;
    }

    try {
      const didWrite = await writeHealthKitWeight(
        entry.weight,
        units === "lbs" ? "lb" : "kg",
        new Date(`${entry.date}T12:00:00`)
      );
      if (!didWrite) {
        result.failed++;
        continue;
      }
      exportState[entry.id] = fingerprint;
      saveHealthKitWeightExportState(exportState);
      result.exported++;
    } catch {
      // Do not save a fingerprint when the native write fails, so it can retry.
      result.failed++;
    }
  }

  return result;
}