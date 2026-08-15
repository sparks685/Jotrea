/**
 * useOralDoseMigration — bidirectional dose-site migration tests
 *
 * Confirms that the migration hook correctly handles both directions when a
 * custom medication's formulation changes, both on initial mount and mid-session
 * (where the same mounted component receives an updated medication via a
 * StorageEvent, mirroring what happens when the user switches formulation).
 *
 * Scenarios covered:
 *   1. Initial mount — injection → oral: non-oral sites corrected to "oral"
 *   2. Initial mount — oral → injection: "oral" sites updated to injectionSite
 *   3. Mid-session — injection → oral: hook re-fires when injectionSite removed
 *   4. Mid-session — oral → injection: hook re-fires when injectionSite added
 *   5. Idempotency in both directions: no writes when data is already correct
 *   6. Period scoping: doses before startDate are never touched
 */

import { render, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that trigger them
// ---------------------------------------------------------------------------

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  initGA: vi.fn(),
  pageView: vi.fn(),
}));

vi.mock("@/utils/notifications", () => ({
  isNotificationSupported: () => true,
  rescheduleAllNotifications: vi.fn(),
  cancelNotificationTag: vi.fn(),
  scheduleAllNotifications: vi.fn(),
  cancelAllNotifications: vi.fn(),
  getNextScheduledTime: vi.fn(() => null),
  requestNotificationPermission: vi.fn(async () => "default" as NotificationPermission),
  registerNotificationSW: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import subject AFTER mocks
// ---------------------------------------------------------------------------

import { useOralDoseMigration } from "@/hooks/useMedication";

// ---------------------------------------------------------------------------
// Minimal harness — mounts the hook, renders nothing
// ---------------------------------------------------------------------------

function MigrationHarness() {
  useOralDoseMigration();
  return null;
}

// ---------------------------------------------------------------------------
// localStorage keys & helpers
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";
const DOSES_KEY = "jotrea_doses";

/** Custom injection medication — id stays "custom", injectionSite signals injection. */
function buildCustomInjectionMed(injectionSite = "Abdomen", startDate = "2024-01-01") {
  return {
    id: "custom",
    genericName: "Custom Drug",
    brandName: "My Custom Injection",
    dose: 1,
    frequency: "weekly",
    startDate,
    active: true,
    injectionSite,
  };
}

/** Custom oral medication — id stays "custom", no injectionSite → treated as oral. */
function buildCustomOralMed(startDate = "2024-01-01") {
  return {
    id: "custom",
    genericName: "Custom Drug",
    brandName: "My Custom Oral",
    dose: 1,
    frequency: "weekly",
    startDate,
    active: true,
    // no injectionSite → isOralMedication returns true
  };
}

/**
 * Seeds the medication key and dispatches a StorageEvent so that any mounted
 * useLocalStorage("jotrea_medication") consumer re-renders with the new value.
 */
function seedMedication(med: object) {
  const serialized = JSON.stringify(med);
  localStorage.setItem(MEDICATION_KEY, serialized);
  window.dispatchEvent(
    new StorageEvent("storage", { key: MEDICATION_KEY, newValue: serialized }),
  );
}

function seedDoses(doses: object[]) {
  localStorage.setItem(DOSES_KEY, JSON.stringify(doses));
}

function readDoses(): Array<{ id: string; site?: string; date: string; [k: string]: unknown }> {
  return JSON.parse(localStorage.getItem(DOSES_KEY) ?? "[]");
}

// ---------------------------------------------------------------------------
// 1. Initial-mount — injection → oral
// ---------------------------------------------------------------------------

describe("useOralDoseMigration initial mount — injection → oral", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("corrects a single injection-site dose to 'oral' when mounted with an oral medication", () => {
    seedMedication(buildCustomOralMed());
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "Abdomen", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    expect(readDoses()[0].site).toBe("oral");
  });

  it("corrects all injection site variants (Thigh, Upper Arm, Buttocks) to 'oral'", () => {
    seedMedication(buildCustomOralMed());
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "Thigh",     notes: "", taken: true },
      { id: "2", date: "2024-03-08", time: "08:00", doseAmount: 1, site: "Upper Arm", notes: "", taken: true },
      { id: "3", date: "2024-03-15", time: "08:00", doseAmount: 1, site: "Buttocks",  notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    expect(readDoses().every((d) => d.site === "oral")).toBe(true);
  });

  it("leaves doses before startDate untouched while migrating current-period doses", () => {
    seedMedication(buildCustomOralMed());
    seedDoses([
      { id: "old", date: "2023-12-01", time: "08:00", doseAmount: 1, site: "Thigh", notes: "", taken: true },
      { id: "new", date: "2024-02-01", time: "08:00", doseAmount: 1, site: "Thigh", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    const doses = readDoses();
    expect(doses.find((d) => d.id === "old")?.site).toBe("Thigh"); // untouched
    expect(doses.find((d) => d.id === "new")?.site).toBe("oral");  // migrated
  });
});

// ---------------------------------------------------------------------------
// 2. Initial-mount — oral → injection
// ---------------------------------------------------------------------------

describe("useOralDoseMigration initial mount — oral → injection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("corrects a single 'oral' dose to the medication's injectionSite (Abdomen)", () => {
    seedMedication(buildCustomInjectionMed("Abdomen"));
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    expect(readDoses()[0].site).toBe("Abdomen");
  });

  it("uses the medication's current injectionSite value (Thigh)", () => {
    seedMedication(buildCustomInjectionMed("Thigh"));
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
      { id: "2", date: "2024-03-08", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    const doses = readDoses();
    expect(doses[0].site).toBe("Thigh");
    expect(doses[1].site).toBe("Thigh");
  });

  it("leaves doses before startDate untouched while migrating current-period doses", () => {
    seedMedication(buildCustomInjectionMed("Abdomen"));
    seedDoses([
      { id: "old", date: "2023-11-15", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
      { id: "new", date: "2024-02-01", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    const doses = readDoses();
    expect(doses.find((d) => d.id === "old")?.site).toBe("oral");    // untouched
    expect(doses.find((d) => d.id === "new")?.site).toBe("Abdomen"); // migrated
  });

  it("does not migrate 'oral' doses when no injectionSite is available on the medication", () => {
    // Catalog injection medication (formulation: "injection" in catalogue) without a
    // custom injectionSite stored in MedicationData.
    // isOral = false (catalogue signals injection), but injectionSite = undefined
    // → the `else if (injectionSite)` branch is skipped, so doses are left as-is.
    seedMedication({
      id: "semaglutide-ozempic",
      genericName: "Semaglutide",
      brandName: "Ozempic",
      dose: 0.5,
      frequency: "weekly",
      startDate: "2024-01-01",
      active: true,
      // no injectionSite in stored MedicationData
    });
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 0.5, site: "oral", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    // Without an injectionSite target the hook cannot migrate; site must remain "oral"
    expect(readDoses()[0].site).toBe("oral");
  });
});

// ---------------------------------------------------------------------------
// 3. Mid-session — custom medication changes injection → oral (same id)
//
// The regression surface: id stays "custom" throughout; only injectionSite
// changes (removed). The hook's useEffect must re-fire and migrate the doses.
// ---------------------------------------------------------------------------

describe("useOralDoseMigration mid-session — injection → oral (id stays 'custom')", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates injection-site doses to 'oral' when injectionSite is removed mid-session", () => {
    // Start: custom injection medication with a dose that already has the injection site
    seedMedication(buildCustomInjectionMed("Abdomen"));
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "Abdomen", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    // Sanity: dose is still "Abdomen" after the injection-direction mount (nothing to migrate)
    expect(readDoses()[0].site).toBe("Abdomen");

    // Mid-session: user changes formulation to oral (injectionSite removed, same id)
    act(() => {
      seedMedication(buildCustomOralMed());
    });

    // Hook must have re-run and migrated "Abdomen" → "oral"
    expect(readDoses()[0].site).toBe("oral");
  });

  it("migrates multiple injection-site doses to 'oral' mid-session", () => {
    seedMedication(buildCustomInjectionMed("Thigh"));
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "Thigh", notes: "", taken: true },
      { id: "2", date: "2024-03-08", time: "08:00", doseAmount: 1, site: "Thigh", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    act(() => {
      seedMedication(buildCustomOralMed());
    });

    expect(readDoses().every((d) => d.site === "oral")).toBe(true);
  });

  it("does not touch pre-startDate doses when formulation changes mid-session", () => {
    seedMedication(buildCustomInjectionMed("Abdomen"));
    seedDoses([
      { id: "old", date: "2023-12-01", time: "08:00", doseAmount: 1, site: "Abdomen", notes: "", taken: true },
      { id: "new", date: "2024-02-01", time: "08:00", doseAmount: 1, site: "Abdomen", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    act(() => {
      seedMedication(buildCustomOralMed());
    });

    const doses = readDoses();
    expect(doses.find((d) => d.id === "old")?.site).toBe("Abdomen"); // untouched
    expect(doses.find((d) => d.id === "new")?.site).toBe("oral");    // migrated
  });
});

// ---------------------------------------------------------------------------
// 4. Mid-session — custom medication changes oral → injection (same id)
//
// The regression surface: id stays "custom" throughout; injectionSite is
// added. The hook's useEffect must re-fire and migrate the doses.
// ---------------------------------------------------------------------------

describe("useOralDoseMigration mid-session — oral → injection (id stays 'custom')", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates 'oral' doses to the new injectionSite when it is added mid-session", () => {
    // Start: custom oral medication with "oral" doses
    seedMedication(buildCustomOralMed());
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    // Sanity: doses are still "oral" after the oral-direction mount (nothing to migrate)
    expect(readDoses()[0].site).toBe("oral");

    // Mid-session: user changes formulation to injection (injectionSite added, same id)
    act(() => {
      seedMedication(buildCustomInjectionMed("Abdomen"));
    });

    // Hook must have re-run and migrated "oral" → "Abdomen"
    expect(readDoses()[0].site).toBe("Abdomen");
  });

  it("uses the new injectionSite value (Upper Arm) when migrating mid-session", () => {
    seedMedication(buildCustomOralMed());
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
      { id: "2", date: "2024-03-08", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    act(() => {
      seedMedication(buildCustomInjectionMed("Upper Arm"));
    });

    const doses = readDoses();
    expect(doses[0].site).toBe("Upper Arm");
    expect(doses[1].site).toBe("Upper Arm");
  });

  it("does not touch pre-startDate doses when formulation changes mid-session", () => {
    seedMedication(buildCustomOralMed());
    seedDoses([
      { id: "old", date: "2023-12-01", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
      { id: "new", date: "2024-02-01", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);

    act(() => {
      seedMedication(buildCustomInjectionMed("Abdomen"));
    });

    const doses = readDoses();
    expect(doses.find((d) => d.id === "old")?.site).toBe("oral");    // untouched
    expect(doses.find((d) => d.id === "new")?.site).toBe("Abdomen"); // migrated
  });
});

// ---------------------------------------------------------------------------
// 5. Idempotency — injection → oral direction
// ---------------------------------------------------------------------------

describe("useOralDoseMigration idempotency — injection → oral", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("issues no write when all doses already have site 'oral' on initial mount", () => {
    seedMedication(buildCustomOralMed());
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
      { id: "2", date: "2024-03-08", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
    ]);

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<MigrationHarness />);

    expect(setItemSpy.mock.calls.filter(([key]) => key === DOSES_KEY)).toHaveLength(0);
    setItemSpy.mockRestore();
  });

  it("issues no second write when remounted after a successful migration", () => {
    seedMedication(buildCustomOralMed());
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "Abdomen", notes: "", taken: true },
    ]);

    const { unmount } = render(<MigrationHarness />);
    expect(readDoses()[0].site).toBe("oral");
    unmount();

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<MigrationHarness />);

    expect(setItemSpy.mock.calls.filter(([key]) => key === DOSES_KEY)).toHaveLength(0);
    setItemSpy.mockRestore();
  });

  it("issues no additional write when the oral medication is re-dispatched mid-session with no dirty doses", () => {
    seedMedication(buildCustomOralMed());
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "Abdomen", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);
    expect(readDoses()[0].site).toBe("oral");

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    // Re-dispatch the same oral medication — no dirty doses remain
    act(() => {
      seedMedication(buildCustomOralMed());
    });

    expect(setItemSpy.mock.calls.filter(([key]) => key === DOSES_KEY)).toHaveLength(0);
    setItemSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 6. Idempotency — oral → injection direction
// ---------------------------------------------------------------------------

describe("useOralDoseMigration idempotency — oral → injection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("issues no write when all doses already match injectionSite on initial mount", () => {
    seedMedication(buildCustomInjectionMed("Thigh"));
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "Thigh", notes: "", taken: true },
    ]);

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<MigrationHarness />);

    expect(setItemSpy.mock.calls.filter(([key]) => key === DOSES_KEY)).toHaveLength(0);
    setItemSpy.mockRestore();
  });

  it("issues no second write when remounted after a successful migration", () => {
    seedMedication(buildCustomInjectionMed("Abdomen"));
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
    ]);

    const { unmount } = render(<MigrationHarness />);
    expect(readDoses()[0].site).toBe("Abdomen");
    unmount();

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<MigrationHarness />);

    expect(setItemSpy.mock.calls.filter(([key]) => key === DOSES_KEY)).toHaveLength(0);
    setItemSpy.mockRestore();
  });

  it("issues no additional write when the injection medication is re-dispatched mid-session with no dirty doses", () => {
    seedMedication(buildCustomInjectionMed("Abdomen"));
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 1, site: "oral", notes: "", taken: true },
    ]);

    render(<MigrationHarness />);
    expect(readDoses()[0].site).toBe("Abdomen");

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    // Re-dispatch the same injection medication — no dirty doses remain
    act(() => {
      seedMedication(buildCustomInjectionMed("Abdomen"));
    });

    expect(setItemSpy.mock.calls.filter(([key]) => key === DOSES_KEY)).toHaveLength(0);
    setItemSpy.mockRestore();
  });
});
