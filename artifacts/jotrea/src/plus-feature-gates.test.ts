import { describe, expect, it } from "vitest";
import {
  buildDoseCSV,
  buildWeightCSV,
  filterForFreeTier,
  isCalendarMonthLocked,
  isPremium,
} from "@/utils/featureGates";

describe("Jotrea Plus feature boundaries", () => {
  it("recognizes only premium subscriptions as Plus", () => {
    expect(isPremium("premium")).toBe(true);
    expect(isPremium("free")).toBe(false);
  });

  it("keeps complete medication and weight history free", () => {
    const oldEntries = [{ date: "2020-01-01", id: "old" }, { date: "2026-01-01", id: "new" }];
    expect(filterForFreeTier(oldEntries, "free")).toEqual({ visible: oldEntries, locked: [] });
    expect(isCalendarMonthLocked(2020, 0, "free")).toBe(false);
  });

  it("keeps basic CSV exports available without a subscription", () => {
    expect(buildDoseCSV([{
      id: "dose-1",
      date: "2026-01-01",
      time: "09:00",
      doseAmount: 1,
      site: "oral",
      notes: "",
      taken: true,
    }])).toContain("2026-01-01");
    expect(buildWeightCSV([{ id: "weight-1", date: "2026-01-01", weight: 180 }], "lbs"))
      .toContain("180");
  });
});