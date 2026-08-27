import { describe, expect, it } from "vitest";
import { buildVisitSummaryPdf, getVisitSummaryFilename, VISIT_SUMMARY_DISCLAIMER } from "./visitSummaryPdf";

describe("provider visit summary PDF", () => {
  it("uses the required dated filename", () => {
    expect(getVisitSummaryFilename(new Date(2026, 7, 27)))
      .toBe("Jotrea-Visit-Summary-2026-08-27.pdf");
  });

  it("includes all required sections and tracker-only positioning", () => {
    const doc = buildVisitSummaryPdf({
      trackerName: "Alex",
      medication: {
        id: "wegovy", brandName: "Wegovy", genericName: "semaglutide",
        dose: 1, frequency: "weekly", startDate: "2026-08-01", active: true,
      },
      doses: [{
        id: "d1", date: "2026-08-20", time: "09:00", doseAmount: 1,
        site: "abdomen", notes: "Recorded note", taken: true, sideEffects: ["Nausea"],
      }],
      weights: [{ id: "w1", date: "2026-08-21", weight: 180 }],
      units: "lbs",
    }, new Date(2026, 7, 27));
    const rendered = doc.output();
    expect(rendered).toContain("Jotrea");
    expect(rendered).toContain("Current prescribed medication");
    expect(rendered).toContain("Recorded doses");
    expect(rendered).toContain("Weight");
    expect(rendered).toContain("Recorded symptoms");
    expect(rendered).toContain("This summary reflects user-recorded prescribed information only.");
    expect(rendered).toContain("calculate, recommend, modify, or verify medication use or medical care.");
    expect(VISIT_SUMMARY_DISCLAIMER).not.toMatch(/advice|dosage recommendation/i);
  });

  it("paginates long notes and symptom histories without dropping the disclaimer", () => {
    const doc = buildVisitSummaryPdf({
      trackerName: "Alex",
      medication: null,
      doses: Array.from({ length: 80 }, (_, index) => ({
        id: `d${index}`, date: "2026-08-20", time: "09:00", doseAmount: 1,
        site: "oral", notes: "A long user-recorded note ".repeat(8), taken: true,
        sideEffects: [`Symptom ${index}`],
      })),
      weights: [],
      units: "lbs",
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output()).toContain("Tracker-only disclaimer");
    expect(doc.output()).toContain("calculate, recommend, modify, or verify medication use or medical care.");
  });
});