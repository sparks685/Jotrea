import { describe, expect, it } from "vitest";
import { orderWeightEntries } from "@/utils/weightEntries";

describe("orderWeightEntries", () => {
  it("keeps historical dates chronological and same-day appends in entry order", () => {
    const entries = [
      { id: "first-today", date: "2026-09-20", weight: 190 },
      { id: "historical", date: "2026-09-18", weight: 192 },
      { id: "latest-today", date: "2026-09-20", weight: 188 },
      { id: "middle", date: "2026-09-19", weight: 191 },
    ];

    expect(orderWeightEntries(entries).map((entry) => entry.id)).toEqual([
      "historical",
      "middle",
      "first-today",
      "latest-today",
    ]);
    expect(entries.map((entry) => entry.id)).toEqual([
      "first-today",
      "historical",
      "latest-today",
      "middle",
    ]);
  });
});
