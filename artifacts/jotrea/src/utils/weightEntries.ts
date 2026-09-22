import type { WeightEntry } from "@/types";

/**
 * Sort weight entries from oldest to newest.
 *
 * Weight entries only store a calendar date, so entries logged on the same day
 * are ordered by their position in storage. Since new entries are appended,
 * this keeps the older same-day entry first and makes the latest append the
 * current weight.
 */
export function orderWeightEntries(entries: WeightEntry[]): WeightEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        a.entry.date.localeCompare(b.entry.date) ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);
}
