import { useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { medications } from "@/data/medications";
import { isOralMedication } from "@/utils/medicationUtils";
import type { MedicationData, DoseEntry, UserData, WeightEntry } from "@/types";

interface DailyCheckin {
  date: string;
  water: boolean;
  protein: boolean;
  steps: boolean;
}

const DEFAULT_USER: UserData = {
  name: "",
  units: "lbs",
  subscription: "free",
};

/**
 * Structural validation of a stored medication record.
 *
 * localStorage can hold a malformed `jotrea_medication` (partial write,
 * manual tampering, iOS storage eviction). If we hand a broken record to the
 * UI, Dashboard renders in a crashed/blank state with no way out. Rejecting
 * invalid shapes here makes that state impossible: callers see `null` and
 * App.tsx redirects to onboarding, giving the user a clean recovery path.
 */
export function isValidMedication(value: unknown): value is MedicationData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    m.id.length > 0 &&
    typeof m.dose === "number" &&
    Number.isFinite(m.dose) &&
    typeof m.startDate === "string" &&
    typeof m.frequency === "string"
  );
}

export function useMedication() {
  const [medication, setMedication] = useLocalStorage<MedicationData | null>("jotrea_medication", null);
  // Defensive read: a structurally invalid record is treated as "no
  // medication", which routes the user back to onboarding instead of
  // trapping them on a broken Dashboard.
  const safeMedication = medication !== null && isValidMedication(medication) ? medication : null;
  return { medication: safeMedication, setMedication };
}

export function useDoses() {
  const [doses, setDoses] = useLocalStorage<DoseEntry[]>("jotrea_doses", []);
  // Guard: if the stored value is corrupted (not an array), treat as empty so
  // callers can safely call .some(), .map(), etc. without crashing.
  const safeDoses = Array.isArray(doses) ? doses : [];
  return { doses: safeDoses, setDoses };
}

export function useWeights() {
  const [weights, setWeights] = useLocalStorage<WeightEntry[]>("jotrea_weights", []);
  // Guard: if the stored value is corrupted (not an array), treat as empty so
  // WeightTracker and the chart can safely call .map(), .sort(), etc.
  const safeWeights = Array.isArray(weights) ? weights : [];
  return { weights: safeWeights, setWeights };
}

/**
 * Structural validation of a stored user record.
 *
 * A malformed `jotrea_user` (partial write, tampering, iOS storage eviction)
 * would otherwise flow straight into Settings and crash on property access.
 * Invalid shapes fall back to DEFAULT_USER so the UI always gets a
 * structurally sound object.
 */
export function isValidUser(value: unknown): value is UserData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const u = value as Record<string, unknown>;
  return (
    typeof u.name === "string" &&
    (u.units === "lbs" || u.units === "kg") &&
    (u.subscription === "free" || u.subscription === "premium")
  );
}

export function useUser() {
  const [user, setUser] = useLocalStorage<UserData>("jotrea_user", DEFAULT_USER);
  // Defensive read: a structurally invalid record falls back to DEFAULT_USER
  // instead of crashing Settings.
  const safeUser = isValidUser(user) ? user : DEFAULT_USER;
  return { user: safeUser, setUser };
}

/**
 * Bidirectional dose-site migration scoped to the CURRENT medication period.
 *
 * Only doses whose `date` falls on or after `medication.startDate` are touched;
 * doses from earlier medication periods are left exactly as recorded, preserving
 * historical accuracy when a user has previously switched between medications.
 *
 * - Injection → Oral: doses in the current period whose site is anything other
 *   than "oral" are corrected to "oral".
 * - Oral → Injection: doses in the current period whose site is "oral" are
 *   updated to the medication's new `injectionSite` value.
 *
 * Re-runs whenever the active medication id, injectionSite, or startDate
 * changes. Idempotent — no write is issued when nothing needs migrating.
 */
export function useOralDoseMigration() {
  const { medication } = useMedication();
  const { setDoses } = useDoses();
  const medicationId = medication?.id ?? null;
  const injectionSite = medication?.injectionSite;
  const startDate = medication?.startDate ?? null;

  useEffect(() => {
    if (!medicationId || !startDate) return;
    const medInfo = medications.find((m) => m.id === medicationId);
    // Shared guard — same logic used in Dashboard/DoseLog when writing the site field
    const isOral = isOralMedication({ injectionSite }, medInfo);

    // Peek at the current doses via localStorage to avoid a stale state
    // snapshot and to skip the write entirely when nothing needs migrating.
    // Guard defensively: malformed JSON or a non-array value must not crash
    // the app — treat both as "nothing to migrate" so the effect exits safely.
    let current: DoseEntry[] = [];
    try {
      const raw = localStorage.getItem("jotrea_doses");
      const parsed = raw ? JSON.parse(raw) : [];
      current = Array.isArray(parsed) ? (parsed as DoseEntry[]) : [];
    } catch {
      // Malformed JSON — fall back to empty; no migration needed
    }

    // Only consider doses that belong to the current medication period.
    // Doses before startDate were logged under a different medication/formulation
    // and must not be rewritten.
    const inCurrentPeriod = (d: DoseEntry) => d.date >= startDate;

    if (isOral) {
      // Injection → Oral: correct non-"oral" site values to "oral" for the
      // current period only.
      const hasDirty = current.some((d) => inCurrentPeriod(d) && d.site && d.site !== "oral");
      if (!hasDirty) return; // idempotent: no write when already clean
      setDoses((prev) =>
        prev.map((d) =>
          inCurrentPeriod(d) && d.site && d.site !== "oral"
            ? { ...d, site: "oral" }
            : d
        )
      );
    } else if (injectionSite) {
      // Oral → Injection: correct "oral" site values to the new injection site
      // for the current period only.
      const hasDirty = current.some((d) => inCurrentPeriod(d) && d.site === "oral");
      if (!hasDirty) return; // idempotent: no write when already clean
      setDoses((prev) =>
        prev.map((d) =>
          inCurrentPeriod(d) && d.site === "oral"
            ? { ...d, site: injectionSite }
            : d
        )
      );
    }
  }, [medicationId, injectionSite, startDate]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useDailyCheckin() {
  const today = new Date().toISOString().slice(0, 10);
  const [raw, setRaw] = useLocalStorage<DailyCheckin>("jotrea_daily_checkin", {
    date: today,
    water: false,
    protein: false,
    steps: false,
  });

  // Auto-reset when a new day starts
  const checkin: DailyCheckin =
    raw.date === today ? raw : { date: today, water: false, protein: false, steps: false };

  const toggle = (key: "water" | "protein" | "steps") => {
    setRaw({ ...checkin, [key]: !checkin[key] });
  };

  return { checkin, toggle };
}
