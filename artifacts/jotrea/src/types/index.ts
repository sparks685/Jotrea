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
  subscriptionProductId?: string;
  subscriptionExpiresAt?: string;
  /** Owner for pre-Cabinet entries that did not yet carry medicationId. */
  legacyDoseMedicationId?: string;
  trialEndDate?: string;
  goalWeight?: number;
  notificationsEnabled?: boolean;
  notificationTime?: string;
  notificationAdvance?: string;
  injectionSiteHistory?: { site: string; date: string }[];
  waterGoalCups?: number;
  proteinGoalG?: number;
  stepsGoal?: number;
}

export type SubscriptionState = "free" | "trial" | "active" | "expired";

export interface SubscriptionProduct {
  id: string;
  interval: "month" | "year";
  displayName: string;
  displayPrice: string;
  trialDays?: number;
}

export interface SubscriptionStatus {
  state: SubscriptionState;
  isPlus: boolean;
  productId?: string;
  expiresAt?: string;
  willRenew?: boolean;
}

export interface CabinetMedication extends MedicationData {
  cabinetId: string;
  nickname?: string;
  reminderTimes: string[];
  createdAt: string;
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
  /** Stable Cabinet identity. Absent for the original single-medication tracker. */
  cabinetId?: string;
}

export interface DoseEntry {
  id: string;
  date: string;
  time: string;
  doseAmount: number;
  site: string;
  notes: string;
  taken: boolean;
  sideEffects?: string[];
  /** The active medication tracker when this entry was recorded. */
  medicationId?: string;
}

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  notes?: string;
  photoUrl?: string;
}
