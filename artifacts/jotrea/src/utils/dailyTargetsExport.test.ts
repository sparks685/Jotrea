import { describe, expect, it } from "vitest";
import { buildDailyTargetsCSV, readDailyTargetsForExport } from "./dailyTargetsExport";
import { DAILY_TARGETS_KEY, LEGACY_CHECKIN_KEY } from "./dailyTargets";

describe("daily targets CSV export", () => {
  it("exports each amount in its original unit, the steps total, and checkmarks without invented amounts", () => {
    const csv = buildDailyTargetsCSV({
      days: {
        "2025-02-03": {
          water: [
            { id: "w1", amount: 240, loggedAt: "2025-02-03T09:00:00Z" },
            { id: "w2", amount: 100, loggedAt: "2025-02-03T12:00:00Z" },
          ],
          protein: [{ id: "p1", amount: 25, loggedAt: "2025-02-03T13:00:00Z" }],
          steps: 0,
          legacy: { water: true, steps: true },
        },
      },
    });
    expect(csv).toContain('"2025-02-03","water","2025-02-03T09:00:00Z","240","mL","Recorded entry","w1"');
    expect(csv).toContain('"2025-02-03","water","2025-02-03T12:00:00Z","100","mL","Recorded entry","w2"');
    expect(csv).toContain('"2025-02-03","protein","2025-02-03T13:00:00Z","25","g","Recorded entry","p1"');
    expect(csv).toContain('"2025-02-03","steps","","0","steps","Daily total",""');
    expect(csv).toContain('"2025-02-03","water","","","","Legacy checkmark (completion only; amount unknown)",""');
    expect(csv).toContain('"2025-02-03","steps","","","","Legacy checkmark (completion only; amount unknown)",""');
  });

  it("reads fresh persisted and legacy records and discards malformed data", () => {
    const data = new Map([
      [DAILY_TARGETS_KEY, JSON.stringify({ days: {
        bad: { steps: 20 },
        "2025-02-03": {
          water: [{ id: "valid", amount: 50, loggedAt: "today" }, { id: "bad", amount: "3", loggedAt: "today" }],
          protein: [], steps: -2,
        },
      } })],
      [LEGACY_CHECKIN_KEY, JSON.stringify({ date: "2025-02-03", steps: true })],
    ]);
    const storage = { getItem: (key: string) => data.get(key) ?? null };
    expect(buildDailyTargetsCSV(readDailyTargetsForExport(storage))).toContain('"valid"');
    const csv = buildDailyTargetsCSV(readDailyTargetsForExport(storage));
    expect(csv).not.toContain('"bad"');
    expect(csv).not.toContain('"20"');
    expect(csv).not.toContain('"-2"');
    expect(csv).toContain('"Legacy checkmark (completion only; amount unknown)"');
    data.set(DAILY_TARGETS_KEY, "{broken");
    data.set(LEGACY_CHECKIN_KEY, "{broken");
    expect(() => readDailyTargetsForExport(storage)).toThrow(/jotrea_daily_targets contains invalid JSON/);
  });

  it("quotes commas, quotes and newlines and neutralizes spreadsheet formulas in every user-controlled cell", () => {
    const csv = buildDailyTargetsCSV({ days: { "2025-02-03": {
      water: [{ id: 'id,"x\n=1', amount: 50, loggedAt: "\t=HYPERLINK(1)" }],
      protein: [{ id: "+SUM(1,2)", amount: 3, loggedAt: "  @CMD()" }],
      steps: null,
    } } });
    expect(csv).toContain('"\'\t=HYPERLINK(1)"');
    expect(csv).toContain('"id,""x\n=1"');
    expect(csv).toContain('"\'  @CMD()"');
    expect(csv).toContain("\"'+SUM(1,2)\"");
  });
});