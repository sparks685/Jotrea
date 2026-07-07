export interface UserData {
  name: string;
  height?: number;
  units: "lbs" | "kg";
  subscription: "free" | "premium";
  trialEndDate?: string;
}

export interface MedicationData {
  id: string;
  genericName: string;
  brandName: string;
  dose: number;
  frequency: "weekly" | "daily" | "twice-daily";
  startDate: string;
  injectionSite?: string;
  active: boolean;
}

export interface DoseEntry {
  id: string;
  date: string;
  time: string;
  doseAmount: number;
  site: string;
  notes: string;
  taken: boolean;
}

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  photoUrl?: string;
}
