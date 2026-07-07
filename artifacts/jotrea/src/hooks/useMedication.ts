import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { MedicationData, DoseEntry, UserData, WeightEntry } from "@/types";

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
