import { describe, expect, it } from "vitest";
import {
  buildDoseCSV,
  buildSymptomCSV,
  buildWeightCSV,
  CSV_EXPORT_FILENAMES,
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
    expect(CSV_EXPORT_FILENAMES).toEqual({
      doses: "jotrea-doses.csv",
      weights: "jotrea-weights.csv",
      symptoms: "jotrea-symptoms.csv",
    });
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
    expect(buildSymptomCSV([{
      id: "dose-1", date: "2026-01-01", time: "09:00", doseAmount: 1,
      site: "oral", notes: "after lunch", taken: true, sideEffects: ["Nausea", "none"],
    }])).toBe("Date,Time,Symptom,Dose (mg),Notes\n2026-01-01,09:00,Nausea,1,after lunch");
  });

  it("neutralizes spreadsheet formulas in user-entered CSV fields", () => {
    const formulaDose = {
      id: "dose-1", date: "2026-01-01", time: "09:00", doseAmount: 1,
      site: "\t-CMD()", notes: " \r=1+1", taken: true,
      sideEffects: ["\t+SUM(1,1)", "  @IMPORTDATA(\"https://example.com\")", " none "],
    };
    const symptomCsv = buildSymptomCSV([formulaDose]);
    const doseCsv = buildDoseCSV([formulaDose]);
    const weightCsv = buildWeightCSV([{
      id: "weight-1", date: "2026-01-01", weight: 180, notes: "\n=1+1",
    }], "lbs");
    expect(symptomCsv).toContain("\"'+SUM(1,1)\"");
    expect(symptomCsv).toContain("\"'@IMPORTDATA(\"\"https://example.com\"\")\"");
    expect(symptomCsv).toContain("\"' \r=1+1\"");
    expect(symptomCsv).not.toContain(",none,");
    expect(doseCsv).toContain("\"'\t-CMD()\"");
    expect(weightCsv).toContain("\"'\n=1+1\"");
  });
});