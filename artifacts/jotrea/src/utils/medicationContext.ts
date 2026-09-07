import { differenceInDays, endOfDay, isWithinInterval, parseISO, startOfDay } from "date-fns";
import type { DoseEntry, WeightEntry } from "@/types";

export type RecordedDoseRange = {
  amount: number;
  startDate: string;
  endDate: string | null;
  duration: string;
};

function durationLabel(startDate: string, endDate: Date): string {
  const days = Math.max(0, differenceInDays(endDate, parseISO(startDate)));
  if (days < 7) return "< 1 week";
  const weeks = Math.round((days / 7) * 10) / 10;
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

export function buildRecordedDoseRanges(
  doses: DoseEntry[],
  isCurrent: boolean,
  today: Date = new Date()
): RecordedDoseRange[] {
  const ordered = [...doses].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  );
  if (!ordered.length) return [];

  const ranges: RecordedDoseRange[] = [];
  let startIndex = 0;
  for (let index = 1; index <= ordered.length; index += 1) {
    const changed = index === ordered.length || ordered[index].doseAmount !== ordered[startIndex].doseAmount;
    if (!changed) continue;

    const lastRecorded = ordered[index - 1];
    const finalRange = index === ordered.length;
    const endDate = finalRange && isCurrent ? null : lastRecorded.date;
    ranges.push({
      amount: ordered[startIndex].doseAmount,
      startDate: ordered[startIndex].date,
      endDate,
      duration: durationLabel(
        ordered[startIndex].date,
        endDate ? parseISO(endDate) : today
      ),
    });
    startIndex = index;
  }
  return ranges;
}

export function getWeightContext(
  weights: WeightEntry[],
  periodStart: string,
  periodEnd: string | null,
  today: Date = new Date()
) {
  const start = startOfDay(parseISO(periodStart));
  const end = endOfDay(periodEnd ? parseISO(periodEnd) : today);
  const periodWeights = [...weights]
    .filter((weight) => isWithinInterval(parseISO(weight.date), { start, end }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!periodWeights.length) return null;
  const first = periodWeights[0];
  const last = periodWeights[periodWeights.length - 1];
  return {
    start: first.weight,
    end: last.weight,
    change: last.weight - first.weight,
    entryCount: periodWeights.length,
  };
}

export function getFrequentRecordedSymptoms(doses: DoseEntry[], limit = 3) {
  const counts = doses
    .flatMap((dose) => dose.sideEffects ?? [])
    .map((symptom) => symptom.trim())
    .filter((symptom) => symptom && symptom.toLowerCase() !== "none")
    .reduce<Record<string, number>>((result, symptom) => {
      result[symptom] = (result[symptom] ?? 0) + 1;
      return result;
    }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}