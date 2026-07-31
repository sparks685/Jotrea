import { useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { medications } from "@/data/medications";
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
 * One-time migration: for oral/pill medications, any dose stored with a
 * non-"oral" site (e.g. "Abdomen" logged before the oral-guard fix) is
 * corrected to "oral". Runs once on mount and is idempotent.
 */
/**
 * One-time migration: for oral/pill medications, any dose stored with a
 * non-"oral" site (e.g. "Abdomen" logged before the oral-guard fix) is
 * corrected to "oral". Re-runs whenever the active medication changes so
 * switching injection → oral during a session is also handled. Idempotent.
 */
export function useOralDoseMigration() {
  const { medication } = useMedication();
  const { setDoses } = useDoses();
  const medicationId = medication?.id ?? null;
  const injectionSite = medication?.injectionSite;

  useEffect(() => {
    if (!medicationId) return;
    const medInfo = medications.find((m) => m.id === medicationId);
    // Same guard used in Dashboard/DoseLog when writing the site field
    const isOral =
      medInfo?.formulation !== "injection" && injectionSite === undefined;
    if (!isOral) return;
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
    const hasDirty = current.some((d) => d.site && d.site !== "oral");
    if (!hasDirty) return; // idempotent: no write when already clean
    // Only call setDoses (which triggers a localStorage write) when there are
    // dirty entries to correct.
    setDoses((prev) =>
      prev.map((d) =>
        d.site && d.site !== "oral" ? { ...d, site: "oral" } : d
      )
    );
  }, [medicationId, injectionSite]); // eslint-disable-line react-hooks/exhaustive-deps
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
