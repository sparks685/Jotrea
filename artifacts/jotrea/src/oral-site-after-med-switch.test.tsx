/**
 * Oral/injection site written correctly immediately after a medication switch
 *
 * End-to-end tests that mount Dashboard, simulate a medication switch via
 * the same localStorage + StorageEvent mechanism that ChangeMedicationSheet's
 * onConfirm triggers (through useMedication / useLocalStorage), then
 * immediately log a dose and assert the persisted DoseEntry.site value.
 *
 * Two symmetric scenarios are covered:
 *
 *   1. Injection → custom oral:  site must be "oral" (not a body-site).
 *   2. Oral → custom injection:  site must be a body-site value (not "oral").
 *
 * This catches a regression where Dashboard.handleLogDose reads `medication`
 * and `medInfo` from its closure and might use stale values from before the
 * switch if the React state update has not yet propagated.
 */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any import that would trigger them
// ---------------------------------------------------------------------------

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
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
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  LineChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock("@/components/CountdownRing", () => ({
  CountdownRing: () => <div data-testid="countdown-ring" />,
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  initGA: vi.fn(),
  pageView: vi.fn(),
}));

vi.mock("@/utils/notifications", () => ({
  isNotificationSupported: () => true,
  cancelNotificationTag: vi.fn(),
  rescheduleAllNotifications: vi.fn(),
  scheduleAllNotifications: vi.fn(),
  cancelAllNotifications: vi.fn(),
  getNextScheduledTime: vi.fn(() => null),
  requestNotificationPermission: vi.fn(async () => "default" as NotificationPermission),
  registerNotificationSW: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import subject AFTER mocks are registered
// ---------------------------------------------------------------------------

import Dashboard from "@/pages/Dashboard";

// ---------------------------------------------------------------------------
// localStorage keys & helpers
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";
const DOSES_KEY = "jotrea_doses";
const USER_KEY = "jotrea_user";

/** Ozempic — catalog-backed injection medication (formulation: "injection"). */
const INJECTION_MED = {
  id: "semaglutide-ozempic",
  genericName: "Semaglutide",
  brandName: "Ozempic",
  dose: 0.5,
  frequency: "weekly",
  startDate: "2024-01-01",
  active: true,
  // injectionSite intentionally absent — catalog carries formulation: "injection"
};

/** Rybelsus — catalog-backed oral (pill) medication. */
const ORAL_MED = {
  id: "semaglutide-rybelsus",
  genericName: "Semaglutide",
  brandName: "Rybelsus",
  dose: 7,
  frequency: "daily",
  startDate: "2024-01-01",
  active: true,
  // no injectionSite — catalog has formulation: "pill"
};

/**
 * Custom oral medication — id: "custom", no injectionSite.
 * Simulates what ChangeMedicationSheet.handleConfirm produces when the user
 * enters a brand name and selects "Pill" or "Other" formulation.
 */
const CUSTOM_ORAL_MED = {
  id: "custom",
  genericName: "My Custom Pill",
  brandName: "Custom Oral",
  dose: 5,
  frequency: "daily",
  startDate: "2024-06-01",
  active: true,
  // no injectionSite → isOralMedication() returns true
};

/**
 * Custom injection medication — id: "custom", injectionSite set.
 * Simulates what ChangeMedicationSheet.handleConfirm produces when the user
 * enters a brand name and leaves the default "Injection" formulation.
 */
const CUSTOM_INJECTION_MED = {
  id: "custom",
  genericName: "My Custom Shot",
  brandName: "Custom Injection",
  dose: 2.5,
  frequency: "weekly",
  startDate: "2024-06-01",
  active: true,
  injectionSite: "Abdomen", // presence signals injection formulation
};

/** Seeds localStorage with a medication and dispatches a StorageEvent so
 *  any mounted useLocalStorage hook picks up the new value immediately. */
function switchMedication(med: object) {
  const serialized = JSON.stringify(med);
  localStorage.setItem(MEDICATION_KEY, serialized);
  window.dispatchEvent(
    new StorageEvent("storage", { key: MEDICATION_KEY, newValue: serialized }),
  );
}

function seedMedication(med: object) {
  localStorage.setItem(MEDICATION_KEY, JSON.stringify(med));
}

function seedUser() {
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({ name: "Test", units: "lbs", subscription: "free" }),
  );
}

/** Returns the array of stored doses from localStorage. */
function readDoses(): Array<{ site?: string; [k: string]: unknown }> {
  return JSON.parse(localStorage.getItem(DOSES_KEY) ?? "[]");
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  seedUser();
});

// ---------------------------------------------------------------------------
// Scenario 1: injection medication → switch to custom oral → log dose
// ---------------------------------------------------------------------------

describe("oral site guard after switching injection → custom oral", () => {
  it("saves site: 'oral' when user logs a dose immediately after switching to a custom oral med", async () => {
    // Start with an injection medication
    seedMedication(INJECTION_MED);
    render(<Dashboard />);

    // Simulate what ChangeMedicationSheet.onConfirm does: write the new
    // medication to localStorage and dispatch a StorageEvent so Dashboard's
    // useMedication hook re-renders with the updated value before the user
    // taps "Log Dose".
    await act(async () => {
      switchMedication(CUSTOM_ORAL_MED);
    });

    // Open the Log Dose sheet
    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // The injection site picker must NOT be visible for an oral medication
    expect(screen.queryByTestId("log-site-abdomen")).toBeNull();

    // Submit the dose
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    // The saved dose entry must carry site: "oral"
    const doses = readDoses();
    expect(doses.length).toBeGreaterThanOrEqual(1);
    expect(doses[doses.length - 1].site).toBe("oral");
  });

  it("saves site: 'oral' after switching from a catalog injection med (no injectionSite stored) to a catalog oral med", async () => {
    seedMedication(INJECTION_MED);
    render(<Dashboard />);

    await act(async () => {
      switchMedication(ORAL_MED);
    });

    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // No injection site picker for an oral (pill) med
    expect(screen.queryByTestId("log-site-abdomen")).toBeNull();

    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const doses = readDoses();
    expect(doses.length).toBeGreaterThanOrEqual(1);
    expect(doses[doses.length - 1].site).toBe("oral");
  });

  it("does NOT write any entry to injectionSiteHistory when logging an oral dose after the switch", async () => {
    seedMedication(INJECTION_MED);
    render(<Dashboard />);

    await act(async () => {
      switchMedication(CUSTOM_ORAL_MED);
    });

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const raw = localStorage.getItem(USER_KEY);
    const user = raw ? (JSON.parse(raw) as { injectionSiteHistory?: unknown[] }) : {};
    const history = user.injectionSiteHistory ?? [];
    expect(history).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: oral medication → switch to custom injection → log dose
// ---------------------------------------------------------------------------

describe("body-site guard after switching oral → custom injection", () => {
  it("saves a body-site value (not 'oral') when user logs a dose immediately after switching to a custom injection med", async () => {
    // Start with an oral medication
    seedMedication(ORAL_MED);
    render(<Dashboard />);

    // Switch to a custom injection medication
    await act(async () => {
      switchMedication(CUSTOM_INJECTION_MED);
    });

    // Open the Log Dose sheet
    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // The injection site picker MUST be visible for an injection medication
    expect(screen.queryByTestId("log-site-abdomen")).not.toBeNull();

    // Submit with the pre-filled (default) site
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const doses = readDoses();
    expect(doses.length).toBeGreaterThanOrEqual(1);
    const savedSite = doses[doses.length - 1].site;
    // Must be a body-site string — must NOT be "oral"
    expect(savedSite).not.toBe("oral");
    expect(typeof savedSite).toBe("string");
    expect((savedSite as string).length).toBeGreaterThan(0);
  });

  it("appends an entry to injectionSiteHistory when logging an injection dose after the switch", async () => {
    seedMedication(ORAL_MED);
    render(<Dashboard />);

    await act(async () => {
      switchMedication(CUSTOM_INJECTION_MED);
    });

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const raw = localStorage.getItem(USER_KEY);
    const user = raw ? (JSON.parse(raw) as { injectionSiteHistory?: Array<{ site: string }> }) : {};
    const history = user.injectionSiteHistory ?? [];
    expect(history.length).toBeGreaterThanOrEqual(1);
    // The recorded site must not be "oral"
    expect(history[history.length - 1].site).not.toBe("oral");
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: no switch — existing oral medication logs "oral" from the start
// ---------------------------------------------------------------------------

describe("baseline: oral medication without a switch logs 'oral' site", () => {
  it("saves site: 'oral' when the medication was oral from the beginning", () => {
    seedMedication(ORAL_MED);
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const doses = readDoses();
    expect(doses.length).toBeGreaterThanOrEqual(1);
    expect(doses[doses.length - 1].site).toBe("oral");
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: no switch — existing injection medication logs a body-site
// ---------------------------------------------------------------------------

describe("baseline: injection medication without a switch logs a body-site", () => {
  it("saves a body-site value (not 'oral') when the medication was injection from the beginning", () => {
    seedMedication(INJECTION_MED);
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const doses = readDoses();
    expect(doses.length).toBeGreaterThanOrEqual(1);
    expect(doses[doses.length - 1].site).not.toBe("oral");
  });
});
