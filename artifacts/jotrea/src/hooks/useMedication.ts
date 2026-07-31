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

export function useMedication() {
  const [medication, setMedication] = useLocalStorage<MedicationData | null>("jotrea_medication", null);
  return { medication, setMedication };
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
  return { weights, setWeights };
}

export function useUser() {
  const [user, setUser] = useLocalStorage<UserData>("jotrea_user", DEFAULT_USER);
  return { user, setUser };
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
