export type DailyTargetKey = "water" | "protein" | "steps";

/** One additive entry (water in mL, protein in grams). */
export interface AmountEntry {
  id: string;
  amount: number;
  /** ISO timestamp of when the entry was recorded. */
  loggedAt: string;
}

/** Completion carried over from the old checkmark-only check-in. No amounts are inferred. */
export interface LegacyCompletion {
  water: boolean;
  protein: boolean;
  steps: boolean;
}

export interface DailyTargetDay {
  /** Local calendar date, yyyy-MM-dd. */
  date: string;
  water: AmountEntry[];
  protein: AmountEntry[];
  /** Manually set total for the day (not incremental). null = not recorded. */
  steps: number | null;
  legacy?: LegacyCompletion;
}

export interface DailyTargetStore {
  version: 1;
  /** Custom cup size in mL used for the water goal and quick adds. */
  cupMl: number;
  days: Record<string, DailyTargetDay>;
}

export interface DailyTargetGoals {
  waterCups: number;
  /** null when no goal can be determined. */
  proteinG: number | null;
  steps: number;
}

export interface DailyTargetProgress {
  key: DailyTargetKey;
  current: number;
  goal: number | null;
  /** 0..1 */
  ratio: number;
  complete: boolean;
  /** True when completion comes only from a legacy checkmark. */
  legacyOnly: boolean;
}
