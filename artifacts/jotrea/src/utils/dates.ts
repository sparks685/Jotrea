import {
  addDays,
  addWeeks,
  format,
  isBefore,
  isAfter,
  parseISO,
  startOfDay,
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
} from "date-fns";
import type { DoseEntry } from "@/types";

export function getNextDoseDate(
  startDate: string,
  frequency: string,
  doses: DoseEntry[]
): Date {
  const start = parseISO(startDate);
  const today = startOfDay(new Date());

  if (frequency === "weekly") {
    let next = startOfDay(start);
    while (isBefore(next, today)) {
      next = addWeeks(next, 1);
    }
    return next;
  } else if (frequency === "daily") {
    const todayStr = format(today, "yyyy-MM-dd");
    const takenToday = doses.some((d) => d.date === todayStr && d.taken);
    return takenToday ? addDays(today, 1) : today;
  } else if (frequency === "twice-daily") {
    const todayStr = format(today, "yyyy-MM-dd");
    const takenToday = doses.filter((d) => d.date === todayStr && d.taken).length;
    return takenToday >= 2 ? addDays(today, 1) : today;
  }
  return today;
}

export function getDaysUntilDose(nextDoseDate: Date): number {
  const today = startOfDay(new Date());
  const next = startOfDay(nextDoseDate);
  return Math.max(0, Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
}

export function getScheduledDatesInMonth(
  startDate: string,
  frequency: string,
  year: number,
  month: number
): string[] {
  const start = parseISO(startDate);
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));
  const results: string[] = [];

  if (frequency === "weekly") {
    let current = startOfDay(start);
    while (isBefore(current, monthStart)) {
      current = addWeeks(current, 1);
    }
    while (!isAfter(current, monthEnd)) {
      if (!isBefore(current, monthStart)) {
        results.push(format(current, "yyyy-MM-dd"));
      }
      current = addWeeks(current, 1);
    }
  } else if (frequency === "daily" || frequency === "twice-daily") {
    const days = getDaysInMonth(new Date(year, month));
    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month, d);
      if (!isBefore(date, startOfDay(start))) {
        results.push(format(date, "yyyy-MM-dd"));
      }
    }
  }

  return results;
}

export function getDateStatus(
  dateStr: string,
  scheduledDates: string[],
  doses: DoseEntry[]
): "taken" | "missed" | "scheduled" | "none" {
  if (!scheduledDates.includes(dateStr)) return "none";
  const today = format(new Date(), "yyyy-MM-dd");
  const takenOnDate = doses.some((d) => d.date === dateStr && d.taken);
  if (takenOnDate) return "taken";
  if (dateStr < today) return "missed";
  return "scheduled";
}

export function getFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case "weekly":
      return "Once weekly";
    case "daily":
      return "Once daily";
    case "twice-daily":
      return "Twice daily";
    default:
      return frequency;
  }
}

export function getNextThreeDoses(startDate: string, frequency: string, doses: DoseEntry[]): string[] {
  const results: string[] = [];
  let next = getNextDoseDate(startDate, frequency, doses);
  for (let i = 0; i < 3; i++) {
    results.push(format(next, "yyyy-MM-dd"));
    if (frequency === "weekly") {
      next = addWeeks(next, 1);
    } else if (frequency === "daily" || frequency === "twice-daily") {
      next = addDays(next, 1);
    } else {
      next = addDays(next, 1);
    }
  }
  return results;
}
