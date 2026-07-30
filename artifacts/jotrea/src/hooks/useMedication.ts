import { useLocalStorage } from "@/hooks/useLocalStorage";
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
  return { doses, setDoses };
}

export function useWeights() {
  const [weights, setWeights] = useLocalStorage<WeightEntry[]>("jotrea_weights", []);
  return { weights, setWeights };
}

export function useUser() {
  const [user, setUser] = useLocalStorage<UserData>("jotrea_user", DEFAULT_USER);
  return { user, setUser };
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
