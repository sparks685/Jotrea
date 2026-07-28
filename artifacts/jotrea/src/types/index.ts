export interface UserData {
  name: string;
  gender?: "female" | "male" | "other" | "prefer_not_to_say";
  birthday?: string; // ISO date string "YYYY-MM-DD"
  heightFt?: number;
  heightIn?: number;
  heightCm?: number;
  heightUnit?: "imperial" | "metric";
  currentWeightLbs?: number;
  currentWeightKg?: number;
  startingWeightLbs?: number;
  startingWeightKg?: number;
  glpStartDate?: string; // ISO date
  goalWeightLbs?: number;
  goalWeightKg?: number;
  goalPaceLbs?: number; // lbs per week
  activityLevel?: "sedentary" | "lightly_active" | "active" | "very_active";
  motivations?: string[];
  troublesomeSideEffects?: string[];
  height?: number; // keep for backward compat
  units: "lbs" | "kg";
  subscription: "free" | "premium";
  trialEndDate?: string;
  goalWeight?: number;
  notificationsEnabled?: boolean;
  notificationTime?: string;
  notificationAdvance?: string;
  injectionSiteHistory?: { site: string; date: string }[];
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
  notes?: string;
  photoUrl?: string;
}
