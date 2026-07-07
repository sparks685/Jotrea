import { parseISO, differenceInWeeks, format, subDays, addWeeks } from "date-fns";
import type { DoseEntry, WeightEntry } from "@/types";

export function calculateBMI(weightLbs: number, heightInches: number): number {
  if (!heightInches || !weightLbs) return 0;
  return (703 * weightLbs) / (heightInches * heightInches);
}

export function calculateBMIFromKg(weightKg: number, heightCm: number): number {
  if (!heightCm || !weightKg) return 0;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function calculateWeightLost(entries: WeightEntry[]): number {
  if (entries.length < 2) return 0;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[0].weight - sorted[sorted.length - 1].weight;
}

export function calculateAvgWeeklyLoss(entries: WeightEntry[]): number {
  if (entries.length < 2) return 0;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const weeks = differenceInWeeks(parseISO(last.date), parseISO(first.date));
  if (weeks === 0) return 0;
  return (first.weight - last.weight) / weeks;
}

export function calculateStreak(
  doses: DoseEntry[],
  startDate: string,
  frequency: string
): number {
  if (!startDate || doses.length === 0) return 0;
  let streak = 0;
  const today = new Date();

  if (frequency === "weekly") {
    let checkDate = parseISO(startDate);
    while (checkDate <= today) {
      const dateStr = format(checkDate, "yyyy-MM-dd");
      const taken = doses.some((d) => d.date === dateStr && d.taken);
      if (taken) {
        streak++;
      } else if (checkDate < today) {
        streak = 0;
      }
      checkDate = addWeeks(checkDate, 1);
    }
  } else {
    let current = today;
    for (let i = 0; i < 365; i++) {
      const dateStr = format(subDays(current, i), "yyyy-MM-dd");
      const taken = doses.some((d) => d.date === dateStr && d.taken);
      if (taken) {
        streak++;
      } else {
        break;
      }
    }
  }
  return streak;
}

export function getLastDose(doses: DoseEntry[]): DoseEntry | null {
  const taken = doses.filter((d) => d.taken).sort((a, b) => b.date.localeCompare(a.date));
  return taken[0] ?? null;
}

export function getLast7WeightEntries(entries: WeightEntry[]): WeightEntry[] {
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);
}
