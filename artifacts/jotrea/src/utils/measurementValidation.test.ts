import { describe, expect, it } from "vitest";
import { birthdayAge, MAX_WEIGHT_KG_DISPLAY, metricHeightLabel, needsWeightConfirmation, previousWeightEntry, validWeightEntries, weightError } from "./measurementValidation";
import { LBS_PER_KG } from "./weightUnits";
import type { WeightEntry } from "@/types";

describe("birthday validation", () => {
  it("rejects impossible and future dates, and respects the birthday anniversary", () => {
    const today = new Date(2026, 5, 10);
    expect(birthdayAge("2026-06-11", today)).toBeNull();
    expect(birthdayAge("2001-02-29", today)).toBeNull();
    expect(birthdayAge("2000-02-29", today)).toBe(26);
    expect(birthdayAge("2000-06-11", today)).toBe(25);
    expect(birthdayAge("2000-06-10", today)).toBe(26);
    expect(birthdayAge("not-a-date", today)).toBeNull();
  });
});

it("rounds only the metric height label, not its stored or BMI input", () => {
  const cm = 5 * 12 * 2.54 + 6 * 2.54;
  expect(cm).toBeCloseTo(167.64, 10);
  expect(metricHeightLabel(cm)).toBe("≈ 168 cm");
  expect(metricHeightLabel(168)).toBe("168 cm");
  expect(cm / 2.54).toBeCloseTo(66, 10);
});

describe("weight validation and confirmation", () => {
  const entries: WeightEntry[] = [
    { id: "a", date: "2026-01-01", weight: 100 },
    { id: "bad", date: "2026-01-02", weight: 9999 },
    { id: "b", date: "2026-01-03", weight: 110, notes: "keep me" },
    { id: "c", date: "2026-01-03", weight: 120 },
  ];

  it("accepts exactly 1500 lbs and exact equivalent kg, rejects larger and non-finite values", () => {
    expect(weightError(1500, "lbs")).toBeNull();
    expect(weightError(1500 / LBS_PER_KG, "kg")).toBeNull();
    expect(MAX_WEIGHT_KG_DISPLAY).toBe(680.4);
    expect(weightError(MAX_WEIGHT_KG_DISPLAY, "kg")).toBeNull();
    expect(weightError(MAX_WEIGHT_KG_DISPLAY + 0.1, "kg")).not.toBeNull();
    expect(weightError(1500.1, "lbs")).not.toBeNull();
    expect(weightError(1500 / LBS_PER_KG + 0.1, "kg")).not.toBeNull();
    for (const bad of ["", " ", "NaN", "Infinity", "0", "-1", "oops"]) expect(weightError(bad, "lbs")).not.toBeNull();
  });

  it("keeps bad history available for repair while filtering stats and selecting the closest earlier entry", () => {
    expect(validWeightEntries(entries, "lbs").map(e => e.id)).toEqual(["a", "b", "c"]);
    expect(validWeightEntries([
      ...entries, null, { id: "missing-date", weight: 110 },
      { id: "invalid-date", date: "2026-02-30", weight: 110 },
      { id: "string-weight", date: "2026-02-02", weight: "110" },
    ] as WeightEntry[], "lbs").map(e => e.id)).toEqual(["a", "b", "c"]);
    expect(previousWeightEntry(entries, "2026-01-03", "lbs")?.id).toBe("c");
    expect(previousWeightEntry(entries, "2026-01-02", "lbs")?.id).toBe("a");
    expect(previousWeightEntry(entries, "2026-01-03", "lbs", "c")?.id).toBe("b");
    expect(needsWeightConfirmation(entries, "2026-01-03", 132, "lbs")).toBe(true);
    expect(needsWeightConfirmation(entries, "2026-01-03", 131.9, "lbs")).toBe(false);
    expect(needsWeightConfirmation(entries, "2025-12-31", 300, "lbs")).toBe(false);
  });
});