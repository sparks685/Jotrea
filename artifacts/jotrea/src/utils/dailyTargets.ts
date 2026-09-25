import { format } from "date-fns";
import type { UserData } from "@/types";
import type {
  AmountEntry,
  DailyTargetDay,
  DailyTargetGoals,
  DailyTargetKey,
  DailyTargetProgress,
  DailyTargetStore,
} from "@/types/dailyTargets";

export const DAILY_TARGETS_KEY = "jotrea_daily_targets";
export const LEGACY_CHECKIN_KEY = "jotrea_daily_checkin";
export const DEFAULT_CUP_ML = 240;
export const MAX_WATER_ML = 20000;
export const MAX_PROTEIN_G = 1000;
export const MAX_STEPS = 200000;

export const STEPS_BY_ACTIVITY: Record<string, number> = {
  sedentary: 5000,
  lightly_active: 7000,
  active: 9000,
  very_active: 10000,
};

export const localDateKey = (d: Date = new Date()) => format(d, "yyyy-MM-dd");

export const emptyStore = (): DailyTargetStore => ({ version: 1, cupMl: DEFAULT_CUP_ML, days: {} });

export const emptyDay = (date: string): DailyTargetDay => ({ date, water: [], protein: [], steps: null });

export const newEntryId = () => `dt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isEntry = (v: unknown): v is AmountEntry => {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === "string" && typeof e.amount === "number" && Number.isFinite(e.amount) && e.amount > 0 && typeof e.loggedAt === "string";
};

export const DAILY_TARGETS_BACKUP_KEY = "jotrea_daily_targets_backup";

/** Strict yyyy-MM-dd that is a real calendar date. */
export function isValidDateKey(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Valid and not in the future relative to the local calendar day. */
export const isLoggableDate = (date: unknown, today: string = localDateKey()): date is string =>
  isValidDateKey(date) && date <= today;

/** Defensive parse of a stored value; malformed pieces are dropped, never thrown. */
export function sanitizeStore(value: unknown): DailyTargetStore {
  return sanitizeStoreWithReport(value).store;
}

/** Like sanitizeStore but also reports how many malformed values were dropped/replaced. */
export function sanitizeStoreWithReport(value: unknown): { store: DailyTargetStore; issues: number } {
  if (value === null || value === undefined) return { store: emptyStore(), issues: 0 };
  const store = sanitizeInner(value);
  const issues = countIssues(value, store);
  return { store, issues };
}

function countIssues(value: unknown, store: DailyTargetStore): number {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return 1;
  const raw = value as Record<string, unknown>;
  let n = 0;
  if (raw.cupMl !== undefined && raw.cupMl !== store.cupMl) n++;
  const days = raw.days;
  if (days !== undefined && (typeof days !== "object" || days === null || Array.isArray(days))) return n + 1;
  for (const [date, d] of Object.entries((days ?? {}) as Record<string, unknown>)) {
    const clean = store.days[date];
    if (!clean) { n++; continue; }
    const day = d as Record<string, unknown>;
    if (Array.isArray(day.water) && day.water.length !== clean.water.length) n++;
    else if (day.water !== undefined && !Array.isArray(day.water)) n++;
    if (Array.isArray(day.protein) && day.protein.length !== clean.protein.length) n++;
    else if (day.protein !== undefined && !Array.isArray(day.protein)) n++;
    if (day.steps !== undefined && day.steps !== null && day.steps !== clean.steps) n++;
  }
  return n;
}

function sanitizeInner(value: unknown): DailyTargetStore {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return emptyStore();
  const raw = value as Record<string, unknown>;
  const cupMl = typeof raw.cupMl === "number" && raw.cupMl > 0 && raw.cupMl <= 2000 ? raw.cupMl : DEFAULT_CUP_ML;
  const days: Record<string, DailyTargetDay> = {};
  if (typeof raw.days === "object" && raw.days !== null && !Array.isArray(raw.days)) {
    for (const [date, d] of Object.entries(raw.days as Record<string, unknown>)) {
      if (!isValidDateKey(date) || typeof d !== "object" || d === null) continue;
      const day = d as Record<string, unknown>;
      const legacy = day.legacy as Record<string, unknown> | undefined;
      days[date] = {
        date,
        water: Array.isArray(day.water) ? day.water.filter(isEntry) : [],
        protein: Array.isArray(day.protein) ? day.protein.filter(isEntry) : [],
        steps: typeof day.steps === "number" && Number.isInteger(day.steps) && day.steps >= 0 && day.steps <= MAX_STEPS ? day.steps : null,
        ...(legacy && typeof legacy === "object"
          ? { legacy: { water: legacy.water === true, protein: legacy.protein === true, steps: legacy.steps === true } }
          : {}),
      };
    }
  }
  return { version: 1, cupMl, days };
}

/**
 * Carry forward a legacy checkmark record as legacy completion for its date.
 * Amounts are never invented. Existing entries for that date are kept.
 */
export function mergeLegacyCheckin(store: DailyTargetStore, legacy: unknown): DailyTargetStore {
  if (typeof legacy !== "object" || legacy === null) return store;
  const l = legacy as Record<string, unknown>;
  // The legacy date was written in UTC; the original local time is unknowable,
  // so the date is kept exactly as recorded (never shifted) and flagged legacy.
  if (!isValidDateKey(l.date)) return store;
  const flags = { water: l.water === true, protein: l.protein === true, steps: l.steps === true };
  if (!flags.water && !flags.protein && !flags.steps) return store;
  const existing = store.days[l.date] ?? emptyDay(l.date);
  if (existing.legacy) return store;
  return { ...store, days: { ...store.days, [l.date]: { ...existing, legacy: flags } } };
}

export function resolveGoals(user: UserData): DailyTargetGoals {
  const proteinG = user.proteinGoalG
    ? user.proteinGoalG
    : user.currentWeightLbs
    ? Math.round((user.currentWeightLbs / 2.20462) * 0.8)
    : null;
  return {
    waterCups: user.waterGoalCups ?? 8,
    proteinG,
    steps: user.stepsGoal ?? (user.activityLevel ? STEPS_BY_ACTIVITY[user.activityLevel] : undefined) ?? 7000,
  };
}

export const sumEntries = (entries: AmountEntry[]) => entries.reduce((s, e) => s + e.amount, 0);

export function computeProgress(
  day: DailyTargetDay,
  goals: DailyTargetGoals,
  cupMl: number,
): Record<DailyTargetKey, DailyTargetProgress> {
  const build = (key: DailyTargetKey, current: number, goal: number | null, hasData: boolean): DailyTargetProgress => {
    const reached = goal !== null && goal > 0 && current >= goal;
    const legacy = !!day.legacy?.[key];
    return {
      key,
      current,
      goal,
      ratio: reached || (legacy && !hasData) ? 1 : goal && goal > 0 ? Math.min(1, current / goal) : 0,
      complete: reached || legacy,
      legacyOnly: legacy && !reached,
    };
  };
  const waterCups = sumEntries(day.water) / cupMl;
  return {
    water: build("water", Math.round(waterCups * 100) / 100, goals.waterCups, day.water.length > 0),
    protein: build("protein", sumEntries(day.protein), goals.proteinG, day.protein.length > 0),
    steps: build("steps", day.steps ?? 0, goals.steps, day.steps !== null),
  };
}

export const formatCups = (n: number) => String(Math.round(n * 100) / 100);
