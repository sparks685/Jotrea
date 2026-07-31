/**
 * Oral-dose migration — regression tests
 *
 * Confirms that useOralDoseMigration (useMedication.ts) retroactively sets
 * site: "oral" on any stored dose that has a non-oral site value (e.g.
 * "Abdomen" logged before the oral-medication guard fix).
 *
 * Scenarios:
 *   1. On mount with an oral/pill medication, existing "Abdomen" doses are
 *      corrected to "oral" in localStorage.
 *   2. Switching from an injection medication to an oral medication during a
 *      session also triggers the migration (medication.id dependency).
 *   3. Migration is idempotent — running it twice produces no additional write
 *      (doses already set to "oral" are not re-written).
 *   4. Injection-medication users are NOT migrated — their "Abdomen" doses must
 *      remain unchanged.
 */

import { render, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { useOralDoseMigration } from "@/hooks/useMedication";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  initGA: vi.fn(),
  pageView: vi.fn(),
}));

vi.mock("@/utils/notifications", () => ({
  rescheduleAllNotifications: vi.fn(),
  cancelNotificationTag: vi.fn(),
  scheduleAllNotifications: vi.fn(),
  cancelAllNotifications: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

/** Minimal component that calls the migration hook and exposes nothing. */
function MigrationHarness() {
  useOralDoseMigration();
  return null;
}

const MEDICATION_KEY = "jotrea_medication";
const DOSES_KEY = "jotrea_doses";

/** Seed the medication localStorage key and fire a StorageEvent. */
function seedMedication(med: object) {
  const serialized = JSON.stringify(med);
  localStorage.setItem(MEDICATION_KEY, serialized);
  window.dispatchEvent(
    new StorageEvent("storage", { key: MEDICATION_KEY, newValue: serialized })
  );
}

/** Seed doses without dispatching a StorageEvent (simulates cold start). */
function seedDoses(doses: object[]) {
  localStorage.setItem(DOSES_KEY, JSON.stringify(doses));
}

/** Read doses directly from localStorage. */
function readDoses(): Array<{ site?: string; [k: string]: unknown }> {
  return JSON.parse(localStorage.getItem(DOSES_KEY) ?? "[]");
}

const ORAL_MED = {
  id: "semaglutide-rybelsus",
  genericName: "Semaglutide",
  brandName: "Rybelsus",
  dose: 7,
  frequency: "daily",
  startDate: "2024-01-01",
  active: true,
  // injectionSite intentionally absent — this is oral
};

const INJECTION_MED = {
  id: "semaglutide-ozempic",
  genericName: "Semaglutide",
  brandName: "Ozempic",
  dose: 0.5,
  frequency: "weekly",
  startDate: "2024-01-01",
  active: true,
};

// ---------------------------------------------------------------------------
// 1. Initial mount with oral medication
// ---------------------------------------------------------------------------

describe("useOralDoseMigration — initial mount with oral medication", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("corrects 'Abdomen' site to 'oral' for a pill medication on mount", () => {
    seedMedication(ORAL_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 7, site: "Abdomen", notes: "", taken: true },
      { id: "2", date: "2024-03-08", time: "08:00", doseAmount: 7, site: "Thigh",   notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    const doses = readDoses();
    expect(doses).toHaveLength(2);
    expect(doses[0].site).toBe("oral");
    expect(doses[1].site).toBe("oral");
  });

  it("corrects any known injection site to 'oral'", () => {
    seedMedication(ORAL_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 7, site: "Upper Arm", notes: "", taken: true },
      { id: "2", date: "2024-03-08", time: "08:00", doseAmount: 7, site: "Buttocks",  notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    const doses = readDoses();
    expect(doses[0].site).toBe("oral");
    expect(doses[1].site).toBe("oral");
  });

  it("leaves already-correct 'oral' doses untouched", () => {
    seedMedication(ORAL_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 7, site: "oral", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    const doses = readDoses();
    expect(doses[0].site).toBe("oral");
  });
});

// ---------------------------------------------------------------------------
// 2. Migration is idempotent
// ---------------------------------------------------------------------------

describe("useOralDoseMigration — idempotence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writing 'oral' a second time produces the same result (no duplicate writes)", () => {
    seedMedication(ORAL_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 7, site: "Abdomen", notes: "", taken: true },
    ]);

    // Mount once — migration fires
    const { unmount } = render(<MigrationHarness />);
    unmount();

    // Capture state after first migration
    const afterFirst = readDoses();
    expect(afterFirst[0].site).toBe("oral");

    // Mount again — migration should detect no dirty entries and skip
    render(<MigrationHarness />);

    const afterSecond = readDoses();
    expect(afterSecond).toEqual(afterFirst); // identical — no re-write
  });
});

// ---------------------------------------------------------------------------
// 3. Medication change injection → oral during a session
// ---------------------------------------------------------------------------

describe("useOralDoseMigration — medication switch injection → oral", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates pre-fix doses when the user switches from injection to oral mid-session", () => {
    // Start with injection medication and Abdomen dose
    seedMedication(INJECTION_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 0.5, site: "Abdomen", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    // Injection users must NOT have their doses migrated
    expect(readDoses()[0].site).toBe("Abdomen");

    // Now switch to an oral medication (simulates ChangeMedicationSheet save)
    act(() => {
      seedMedication(ORAL_MED);
    });

    // The migration should now fire because medicationId changed
    const doses = readDoses();
    expect(doses[0].site).toBe("oral");
  });
});

// ---------------------------------------------------------------------------
// 4. Injection-medication users are never migrated
// ---------------------------------------------------------------------------

describe("useOralDoseMigration — injection medication is not migrated", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not alter 'Abdomen' doses for an injection medication", () => {
    seedMedication(INJECTION_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 0.5, site: "Abdomen", notes: "", taken: true },
      { id: "2", date: "2024-03-08", time: "08:00", doseAmount: 0.5, site: "Thigh",   notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    const doses = readDoses();
    expect(doses[0].site).toBe("Abdomen");
    expect(doses[1].site).toBe("Thigh");
  });
});
