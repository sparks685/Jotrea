/**
 * isOralMedication — unit tests
 *
 * Verifies that the central oral/injection guard (`medicationUtils.ts`) returns
 * the correct result for every meaningful combination of MedicationData and
 * catalogue MedInfo.
 *
 * Scenarios:
 *   1. Known injection medication  (medInfo.formulation === "injection")        → false
 *   2. Known pill medication       (medInfo.formulation === "pill")              → true
 *   3. Custom injection medication (medication.injectionSite set, medInfo null) → false
 *   4. Custom oral medication      (no injectionSite, medInfo null)              → true
 *   5. null medInfo with no injectionSite                                        → true
 *   6. undefined medInfo with no injectionSite                                   → true
 *   7. Known injection med overridden by injectionSite on MedicationData        → false
 *   8. Known pill med that somehow has injectionSite set (edge case)            → false
 */

import { describe, it, expect } from "vitest";
import { isOralMedication } from "@/utils/medicationUtils";

// ---------------------------------------------------------------------------
// Shared medInfo stubs — structural matches for the MedInfo interface
// ---------------------------------------------------------------------------

const INJECTION_MED_INFO = { formulation: "injection" } as const;
const PILL_MED_INFO = { formulation: "pill" } as const;
const UNKNOWN_MED_INFO = {} as const; // no formulation property

// ---------------------------------------------------------------------------
// 1. Known injection medication
// ---------------------------------------------------------------------------

describe("isOralMedication — known injection medication", () => {
  it("returns false for a catalogue injection medication with no injectionSite override", () => {
    expect(
      isOralMedication(
        { injectionSite: undefined },
        INJECTION_MED_INFO,
      ),
    ).toBe(false);
  });

  it("returns false for Ozempic-like injection med (weekly semaglutide injection)", () => {
    expect(
      isOralMedication(
        { injectionSite: undefined },
        { formulation: "injection", frequency: "weekly" },
      ),
    ).toBe(false);
  });

  it("returns false for a twice-daily injection medication", () => {
    expect(
      isOralMedication(
        { injectionSite: undefined },
        { formulation: "injection", frequency: "twice-daily" },
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Known pill medication
// ---------------------------------------------------------------------------

describe("isOralMedication — known pill medication", () => {
  it("returns true for a catalogue pill medication with no injectionSite", () => {
    expect(
      isOralMedication(
        { injectionSite: undefined },
        PILL_MED_INFO,
      ),
    ).toBe(true);
  });

  it("returns true for Rybelsus-like daily pill (semaglutide oral)", () => {
    expect(
      isOralMedication(
        { injectionSite: undefined },
        { formulation: "pill", frequency: "daily" },
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Custom injection medication (injectionSite present, medInfo absent)
// ---------------------------------------------------------------------------

describe("isOralMedication — custom injection medication", () => {
  it("returns false when medication.injectionSite is set (custom injection, no medInfo)", () => {
    expect(
      isOralMedication(
        { injectionSite: "Abdomen" },
        null,
      ),
    ).toBe(false);
  });

  it("returns true when catalogue medInfo formulation is 'pill', even if injectionSite is set (catalogue formulation is authoritative)", () => {
    // When the catalogue entry carries an explicit formulation, that field
    // is the authoritative signal. A "pill" catalogue entry is always oral
    // regardless of whether injectionSite is somehow present. This guards
    // against a stale injectionSite value after a formulation switch.
    expect(
      isOralMedication(
        { injectionSite: "Thigh" },
        PILL_MED_INFO,
      ),
    ).toBe(true);
  });

  it("returns false for all four standard injection-site values", () => {
    for (const site of ["Abdomen", "Thigh", "Upper Arm", "Buttocks"]) {
      expect(
        isOralMedication({ injectionSite: site }, null),
        `site="${site}" should yield false`,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Custom oral medication (no injectionSite, no medInfo)
// ---------------------------------------------------------------------------

describe("isOralMedication — custom oral medication", () => {
  it("returns true when medication.injectionSite is undefined and medInfo is null", () => {
    expect(
      isOralMedication(
        { injectionSite: undefined },
        null,
      ),
    ).toBe(true);
  });

  it("returns true when medication.injectionSite is undefined and medInfo is undefined", () => {
    expect(
      isOralMedication(
        { injectionSite: undefined },
        undefined,
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5 & 6. null / undefined medInfo with no injectionSite
// ---------------------------------------------------------------------------

describe("isOralMedication — null/undefined medInfo, no injectionSite", () => {
  it("returns true when medInfo is null and no injectionSite is stored", () => {
    expect(isOralMedication({ injectionSite: undefined }, null)).toBe(true);
  });

  it("returns true when medInfo is undefined and no injectionSite is stored", () => {
    expect(isOralMedication({ injectionSite: undefined }, undefined)).toBe(true);
  });

  it("returns true when medInfo has no formulation property and no injectionSite is stored", () => {
    expect(isOralMedication({ injectionSite: undefined }, UNKNOWN_MED_INFO)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Formulation property set to an unexpected value
// ---------------------------------------------------------------------------

describe("isOralMedication — unexpected formulation values", () => {
  it("returns true for an unknown formulation string when no injectionSite is set", () => {
    // Only "injection" triggers the injection branch — any other value is treated as oral
    expect(
      isOralMedication(
        { injectionSite: undefined },
        { formulation: "patch" },
      ),
    ).toBe(true);
  });

  it("returns true for an unknown formulation string when injectionSite IS set (catalogue formulation is authoritative)", () => {
    // When medInfo carries an explicit formulation, that value is the sole
    // decider. Any formulation other than "injection" → oral, even if
    // injectionSite is present. This prevents a stale injectionSite from
    // causing misclassification after a formulation switch (e.g. to "other").
    expect(
      isOralMedication(
        { injectionSite: "Abdomen" },
        { formulation: "patch" },
      ),
    ).toBe(true);
  });
});
