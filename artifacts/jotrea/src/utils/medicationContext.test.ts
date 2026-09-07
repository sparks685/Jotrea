import { describe, expect, it } from "vitest";
import {
  buildRecordedDoseRanges,
  getFrequentRecordedSymptoms,
  getWeightContext,
} from "./medicationContext";
import type { DoseEntry } from "@/types";

const doses: DoseEntry[] = [
  { id: "3", date: "2026-08-29", time: "09:00", doseAmount: 0.5, site: "abdomen", notes: "", taken: true, sideEffects: ["Nausea"] },
  { id: "1", date: "2026-08-01", time: "09:00", doseAmount: 0.25, site: "abdomen", notes: "", taken: true },
  { id: "2", date: "2026-08-22", time: "09:00", doseAmount: 0.25, site: "thigh", notes: "", taken: false, sideEffects: ["Nausea", "Fatigue"] },
];

describe("medication history context", () => {
  it("builds factual, non-overlapping recorded amount ranges", () => {
    expect(buildRecordedDoseRanges(doses, true, new Date(2026, 8, 12))).toEqual([
      {
        amount: 0.25,
        startDate: "2026-08-01",
        endDate: "2026-08-22",
        duration: "3 weeks",
      },
      {
        amount: 0.5,
        startDate: "2026-08-29",
        endDate: null,
        duration: "2 weeks",
      },
    ]);
  });

  it("ends a previous tracker's final range at its last recorded dose", () => {
    expect(buildRecordedDoseRanges(doses, false).at(-1)?.endDate).toBe("2026-08-29");
  });

  it("uses only weights recorded inside the tracker period", () => {
    expect(getWeightContext([
      { id: "before", date: "2026-07-31", weight: 190 },
      { id: "start", date: "2026-08-01", weight: 188 },
      { id: "end", date: "2026-08-29", weight: 180 },
      { id: "after", date: "2026-08-30", weight: 179 },
    ], "2026-08-01", "2026-08-29")).toEqual({
      start: 188,
      end: 180,
      change: -8,
      entryCount: 2,
    });
  });

  it("summarizes only symptoms the user actually recorded", () => {
    expect(getFrequentRecordedSymptoms(doses)).toEqual([
      ["Nausea", 2],
      ["Fatigue", 1],
    ]);
  });
});