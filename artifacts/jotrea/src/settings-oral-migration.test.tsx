/**
 * Settings — injection history hidden after oral-dose migration
 *
 * Confirms that the "Injection History" section in Settings is completely
 * hidden for oral-medication users once useOralDoseMigration has corrected
 * pre-fix dose entries that carry a non-"oral" site (e.g. "Abdomen").
 *
 * Scenarios:
 *   1. Pre-fix "Abdomen" doses are migrated to "oral" on mount and the
 *      Settings injection history section is not rendered.
 *   2. Various injection site names (Thigh, Upper Arm, Buttocks) are all
 *      corrected and the section remains hidden.
 *   3. Running the migration a second time is idempotent — no additional
 *      writes occur and the section stays hidden.
 *   4. When there are no doses at all, the section is also absent.
 *   5. Injection-medication users are NOT migrated — their "Abdomen" doses
 *      remain and the section IS shown.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that trigger them
// ---------------------------------------------------------------------------

vi.mock("wouter", () => ({
  useLocation: () => ["/settings", vi.fn()],
  Link: ({
    children,
    asChild: _a,
    ...rest
  }: React.PropsWithChildren<{ asChild?: boolean; href?: string }>) => (
    <a {...rest}>{children}</a>
  ),
  Switch: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Route: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Router: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Redirect: () => null,
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({
          children,
          animate: _a,
          initial: _b,
          exit: _c,
          transition: _d,
          layout: _e,
          whileTap: _f,
          whileHover: _g,
          ...rest
        }: React.PropsWithChildren<Record<string, unknown>>) =>
          React.createElement(tag, rest, children),
    },
  ),
  AnimatePresence: ({ children }: React.PropsWithChildren) => (
    <>{children}</>
  ),
}));

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

vi.mock("@/components/ChangeMedicationSheet", () => ({
  ChangeMedicationSheet: () => null,
}));

// ---------------------------------------------------------------------------
// Import subjects AFTER mocks
// ---------------------------------------------------------------------------

import Settings from "@/pages/Settings";
import { useOralDoseMigration } from "@/hooks/useMedication";

// ---------------------------------------------------------------------------
// Harness: runs the migration hook in the same render tree as Settings,
// exactly as AppRoutes does (useOralDoseMigration() + <Settings />).
// ---------------------------------------------------------------------------

function SettingsWithMigration() {
  useOralDoseMigration();
  return <Settings />;
}

// ---------------------------------------------------------------------------
// localStorage keys & helpers
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";
const DOSES_KEY = "jotrea_doses";
const USER_KEY = "jotrea_user";

/** Oral pill medication — no injectionSite field, formulation: "pill". */
const ORAL_MED = {
  id: "semaglutide-rybelsus",
  genericName: "Semaglutide",
  brandName: "Rybelsus",
  dose: 7,
  frequency: "daily",
  startDate: "2024-01-01",
  active: true,
  // no injectionSite — oral guard treats this as an oral medication
};

/** Injection medication — formulation: "injection" in the medications catalogue. */
const INJECTION_MED = {
  id: "semaglutide-ozempic",
  genericName: "Semaglutide",
  brandName: "Ozempic",
  dose: 0.5,
  frequency: "weekly",
  startDate: "2024-01-01",
  active: true,
};

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

function seedUser() {
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({ name: "Test", units: "lbs", subscription: "free" }),
  );
}

function readDoses(): Array<{ site?: string; [k: string]: unknown }> {
  return JSON.parse(localStorage.getItem(DOSES_KEY) ?? "[]");
}

// ---------------------------------------------------------------------------
// 1. "Abdomen" doses are migrated and Injection History section is hidden
// ---------------------------------------------------------------------------

describe("Settings — injection history hidden after oral migration", () => {
  beforeEach(() => {
    localStorage.clear();
    seedUser();
  });

  it("hides the Injection History section when all doses had site 'Abdomen'", () => {
    seedMedication(ORAL_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 7, site: "Abdomen", notes: "", taken: true },
      { id: "2", date: "2024-03-08", time: "08:00", doseAmount: 7, site: "Abdomen", notes: "", taken: true },
    ]);

    render(<SettingsWithMigration />);

    expect(screen.queryByText("Injection History")).toBeNull();
  });

  it("corrects the stored doses to 'oral' after the section is hidden", () => {
    seedMedication(ORAL_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 7, site: "Abdomen", notes: "", taken: true },
    ]);

    render(<SettingsWithMigration />);

    const doses = readDoses();
    expect(doses[0].site).toBe("oral");
    expect(screen.queryByText("Injection History")).toBeNull();
  });

  it("hides the section when doses have various injection site names", () => {
    seedMedication(ORAL_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 7, site: "Thigh",     notes: "", taken: true },
      { id: "2", date: "2024-03-08", time: "08:00", doseAmount: 7, site: "Upper Arm", notes: "", taken: true },
      { id: "3", date: "2024-03-15", time: "08:00", doseAmount: 7, site: "Buttocks",  notes: "", taken: true },
    ]);

    render(<SettingsWithMigration />);

    expect(screen.queryByText("Injection History")).toBeNull();
    // All corrected to "oral"
    const doses = readDoses();
    expect(doses.every((d) => d.site === "oral")).toBe(true);
  });

  it("hides the section when all doses already have site 'oral' (already migrated)", () => {
    seedMedication(ORAL_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 7, site: "oral", notes: "", taken: true },
    ]);

    render(<SettingsWithMigration />);

    expect(screen.queryByText("Injection History")).toBeNull();
  });

  it("hides the section when there are no doses at all", () => {
    seedMedication(ORAL_MED);
    seedDoses([]);

    render(<SettingsWithMigration />);

    expect(screen.queryByText("Injection History")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Idempotency — second mount produces no additional writes
// ---------------------------------------------------------------------------

describe("Settings oral migration — idempotency", () => {
  beforeEach(() => {
    localStorage.clear();
    seedUser();
  });

  it("second mount does not write to localStorage for doses that are already 'oral'", () => {
    seedMedication(ORAL_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 7, site: "Abdomen", notes: "", taken: true },
    ]);

    // First mount — migration corrects "Abdomen" → "oral"
    const { unmount } = render(<SettingsWithMigration />);
    const afterFirst = readDoses();
    expect(afterFirst[0].site).toBe("oral");
    unmount();

    // Spy on setItem AFTER the first mount so we only count writes on the second mount
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    // Second mount — all doses already have site "oral"; migration must skip the write
    render(<SettingsWithMigration />);

    const dosesWrites = setItemSpy.mock.calls.filter(([key]) => key === DOSES_KEY);
    expect(dosesWrites).toHaveLength(0);

    // Persisted value is unchanged
    expect(readDoses()).toEqual(afterFirst);
    expect(screen.queryByText("Injection History")).toBeNull();

    setItemSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 3. Defensive parse — malformed / non-array dose data must not crash
// ---------------------------------------------------------------------------

describe("Settings oral migration — malformed localStorage data", () => {
  beforeEach(() => {
    localStorage.clear();
    seedUser();
  });

  it("does not crash or write when jotrea_doses contains malformed JSON", () => {
    seedMedication(ORAL_MED);
    // Write intentionally corrupt JSON directly (bypasses the hook's try/catch)
    localStorage.setItem(DOSES_KEY, "not-valid-json{{{");

    // Should render without throwing
    expect(() => render(<SettingsWithMigration />)).not.toThrow();

    // Storage must not have been overwritten with a migration result
    expect(localStorage.getItem(DOSES_KEY)).toBe("not-valid-json{{{");

    // Section is hidden (nothing to show)
    expect(screen.queryByText("Injection History")).toBeNull();
  });

  it("does not crash or write when jotrea_doses is a valid non-array value", () => {
    seedMedication(ORAL_MED);
    // Valid JSON but not an array — migration guard must treat this as empty
    localStorage.setItem(DOSES_KEY, JSON.stringify({ corrupted: true }));

    expect(() => render(<SettingsWithMigration />)).not.toThrow();

    // Value must remain unchanged — no migration write should have occurred
    expect(localStorage.getItem(DOSES_KEY)).toBe(JSON.stringify({ corrupted: true }));
    expect(screen.queryByText("Injection History")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Injection-medication users are NOT migrated and section IS shown
// ---------------------------------------------------------------------------

describe("Settings — injection history visible for injection-medication users", () => {
  beforeEach(() => {
    localStorage.clear();
    seedUser();
  });

  it("shows the Injection History section when the user has an injection medication", () => {
    seedMedication(INJECTION_MED);
    seedDoses([
      { id: "1", date: "2024-03-01", time: "08:00", doseAmount: 0.5, site: "Abdomen", notes: "", taken: true },
    ]);

    render(<SettingsWithMigration />);

    // Section must be visible — injection doses must NOT be touched
    expect(screen.queryByText("Injection History")).not.toBeNull();
    expect(readDoses()[0].site).toBe("Abdomen");
  });
});
