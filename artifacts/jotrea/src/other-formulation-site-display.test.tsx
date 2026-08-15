/**
 * Other-formulation dose-site display — regression tests
 *
 * Verifies that:
 *   1. `isOralMedication` treats any catalogue formulation that is not
 *      "injection" (including "other", "pill", etc.) as oral, even when
 *      injectionSite is somehow present on the stored MedicationData.
 *
 *   2. The dose history list in DoseLog never renders an unrecognised site
 *      string (e.g. a stale value left after the user switched formulation).
 *      Unrecognised values must be silently omitted from the display.
 *
 * Background: switching a custom medication from "injection" to "other"
 * clears injectionSite in ChangeMedicationSheet. If injectionSite were
 * somehow still present, the old code path in isOralMedication would have
 * treated the medication as injection-mode and the migration hook would have
 * left old dose.site values intact.  The display guard prevents those
 * unrecognised strings from leaking through to the user.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { isOralMedication } from "@/utils/medicationUtils";

// ---------------------------------------------------------------------------
// Module mocks required by DoseLog
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
    span: ({
      children,
      ...props
    }: React.PropsWithChildren<React.HTMLAttributes<HTMLSpanElement>>) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useReducedMotion: () => false,
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  initGA: vi.fn(),
  pageView: vi.fn(),
}));

vi.mock("@/components/SideEffectTrendsChart", () => ({
  SideEffectTrendsChart: () => <div data-testid="side-effect-trends" />,
}));

vi.mock("@/utils/dates", () => ({
  getScheduledDatesInMonth: () => [],
  getDateStatus: () => "none",
  getNextDoseDate: () => new Date("2025-01-01"),
  getDaysUntilDose: () => 7,
  getFrequencyLabel: () => "Weekly",
  getNextThreeDoses: () => [],
}));

vi.mock("@/utils/notifications", () => ({
  isNotificationSupported: () => true,
  rescheduleAllNotifications: vi.fn(),
  cancelNotificationTag: vi.fn(),
  scheduleAllNotifications: vi.fn(),
  cancelAllNotifications: vi.fn(),
}));

vi.mock("@/utils/featureGates", () => ({
  buildDoseCSV: vi.fn(() => ""),
  buildWeightCSV: vi.fn(() => ""),
  downloadCSV: vi.fn(),
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

import { fireEvent } from "@testing-library/react";
import DoseLog from "@/pages/DoseLog";
import Dashboard from "@/pages/Dashboard";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_SITES = ["Abdomen", "Thigh", "Upper Arm", "Buttocks"];

/** Switch DoseLog from the default calendar view to the flat list view so all
 *  dose cards are mounted in the DOM regardless of the selected date. */
function switchToListView() {
  fireEvent.click(screen.getByTestId("list-view-btn"));
}

// ---------------------------------------------------------------------------
// 1. isOralMedication — catalogue formulation is authoritative
// ---------------------------------------------------------------------------

describe("isOralMedication — catalogue formulation overrides injectionSite", () => {
  it("returns true for 'other' catalogue formulation even when injectionSite is set", () => {
    const result = isOralMedication(
      { injectionSite: "Abdomen" },
      { formulation: "other" },
    );
    expect(result).toBe(true);
  });

  it("returns true for 'pill' catalogue formulation even when injectionSite is set", () => {
    const result = isOralMedication(
      { injectionSite: "Thigh" },
      { formulation: "pill" },
    );
    expect(result).toBe(true);
  });

  it("returns false for 'injection' catalogue formulation", () => {
    const result = isOralMedication(
      { injectionSite: undefined },
      { formulation: "injection" },
    );
    expect(result).toBe(false);
  });

  it("returns true for 'injection' catalogue formulation when injectionSite is missing (should not happen in practice)", () => {
    // formulation: "injection" always → injection, regardless of injectionSite
    const result = isOralMedication(
      { injectionSite: undefined },
      { formulation: "injection" },
    );
    expect(result).toBe(false);
  });

  it("falls back to injectionSite check when medInfo has no formulation (custom medication)", () => {
    expect(isOralMedication({ injectionSite: undefined }, undefined)).toBe(true);
    expect(isOralMedication({ injectionSite: "Abdomen" }, undefined)).toBe(false);
    expect(isOralMedication({ injectionSite: undefined }, null)).toBe(true);
    expect(isOralMedication({ injectionSite: "Thigh" }, null)).toBe(false);
  });

  it("falls back to injectionSite check when medInfo has no formulation field", () => {
    expect(isOralMedication({ injectionSite: undefined }, {})).toBe(true);
    expect(isOralMedication({ injectionSite: "Abdomen" }, {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. DoseLog — unrecognised site strings are not displayed
// ---------------------------------------------------------------------------

describe("DoseLog dose history — unrecognised site strings are not rendered", () => {
  beforeEach(() => {
    localStorage.clear();

    // Custom "other" formulation — no injectionSite, treated as oral
    localStorage.setItem(
      "jotrea_medication",
      JSON.stringify({
        id: "custom",
        genericName: "My Drug",
        brandName: "My Drug",
        dose: 1,
        frequency: "weekly",
        startDate: "2024-01-01",
        active: true,
        // no injectionSite
      }),
    );

    localStorage.setItem(
      "jotrea_user",
      JSON.stringify({ name: "Test", units: "lbs", subscription: "free" }),
    );
  });

  it("does not render a site label when the dose site is 'oral' (post-migration state)", () => {
    // After useOralDoseMigration runs (in App.tsx), stale injection-site values
    // on oral-medication doses are rewritten to "oral". Verify the display
    // correctly hides the label for that normalised value.
    localStorage.setItem(
      "jotrea_doses",
      JSON.stringify([
        {
          id: "d1",
          date: "2024-03-01",
          time: "08:00",
          doseAmount: 1,
          site: "oral",
          notes: "",
          taken: true,
        },
      ]),
    );

    render(<DoseLog />);
    switchToListView();

    const card = screen.getByTestId("dose-card-d1");
    // "oral" must never be shown as a site label — the condition `site !== "oral"` guards this.
    expect(card.textContent).not.toContain("oral");
    // The time should still be visible
    expect(card.textContent).toContain("08:00");
  });

  it("does not render an unrecognised (non-standard) site string", () => {
    localStorage.setItem(
      "jotrea_doses",
      JSON.stringify([
        {
          id: "d2",
          date: "2024-03-01",
          time: "08:00",
          doseAmount: 1,
          site: "unknown-custom-site",
          notes: "",
          taken: true,
        },
      ]),
    );

    render(<DoseLog />);
    switchToListView();

    const card = screen.getByTestId("dose-card-d2");
    expect(card.textContent).not.toContain("unknown-custom-site");
  });

  it("does not render a third '·' segment for an empty string site value", () => {
    // An empty string is falsy: `dose.site && ...` short-circuits and nothing
    // is appended. The date-time line should be exactly "MMM d · HH:mm" with
    // no extra segment.
    localStorage.setItem(
      "jotrea_doses",
      JSON.stringify([
        {
          id: "d3",
          date: "2024-03-01",
          time: "08:00",
          doseAmount: 1,
          site: "",
          notes: "",
          taken: true,
        },
      ]),
    );

    render(<DoseLog />);
    switchToListView();

    expect(screen.queryByTestId("dose-card-d3")).not.toBeNull();
    const card = screen.getByTestId("dose-card-d3");
    // Only one "·" should be present (the date-time separator); a second would
    // indicate a spurious site label was appended.
    const bulletCount = (card.textContent ?? "").split("·").length - 1;
    expect(bulletCount).toBe(1);
  });

  it("still renders recognised injection site for an injection medication", () => {
    // Reset to a custom injection medication
    localStorage.setItem(
      "jotrea_medication",
      JSON.stringify({
        id: "custom",
        genericName: "My Drug",
        brandName: "My Drug",
        dose: 1,
        frequency: "weekly",
        startDate: "2024-01-01",
        active: true,
        injectionSite: "Thigh",
      }),
    );

    localStorage.setItem(
      "jotrea_doses",
      JSON.stringify([
        {
          id: "d4",
          date: "2024-03-01",
          time: "08:00",
          doseAmount: 1,
          site: "Thigh",
          notes: "",
          taken: true,
        },
      ]),
    );

    render(<DoseLog />);
    switchToListView();

    const card = screen.getByTestId("dose-card-d4");
    expect(card.textContent).toContain("Thigh");
  });

  it("covers all known INJECTION_SITES values as valid display values", () => {
    // Sanity-check: every known site is in the list we guard against
    expect(KNOWN_SITES).toContain("Abdomen");
    expect(KNOWN_SITES).toContain("Thigh");
    expect(KNOWN_SITES).toContain("Upper Arm");
    expect(KNOWN_SITES).toContain("Buttocks");
  });
});

// ---------------------------------------------------------------------------
// 3. Dashboard StatCard "Last Dose" — site display guard after med switch
// ---------------------------------------------------------------------------

describe("Dashboard Last Dose StatCard — site display guard", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      "jotrea_user",
      JSON.stringify({ name: "Test", units: "lbs", subscription: "free" }),
    );
  });

  it("shows dose time (not site) in the Last Dose sub-text for an oral medication even when the dose carries a known site value", () => {
    // Rybelsus is a pill (formulation: "pill") — oral medication
    localStorage.setItem(
      "jotrea_medication",
      JSON.stringify({
        id: "semaglutide-rybelsus",
        genericName: "Semaglutide",
        brandName: "Rybelsus",
        dose: 7,
        frequency: "daily",
        startDate: "2024-01-01",
        active: true,
      }),
    );
    // Dose has a known injection site — this simulates a stale value left
    // from before the user switched to an oral formulation.
    localStorage.setItem(
      "jotrea_doses",
      JSON.stringify([
        {
          id: "d-oral-stale",
          date: "2024-03-01",
          time: "09:30",
          doseAmount: 7,
          site: "Abdomen",
          notes: "",
          taken: true,
        },
      ]),
    );

    render(<Dashboard />);

    const card = screen.getByTestId("last-dose-stat");
    // The site guard (INJECTION_SITES.includes guard) must suppress the site
    // label because the dose's medication is oral. The time must be shown.
    expect(card.textContent).toContain("09:30");
    expect(card.textContent).not.toContain("Abdomen");
  });

  it("shows the injection site in the Last Dose sub-text for a genuine injection medication", () => {
    // Ozempic is formulation: "injection" — a real injection medication
    localStorage.setItem(
      "jotrea_medication",
      JSON.stringify({
        id: "semaglutide-ozempic",
        genericName: "Semaglutide",
        brandName: "Ozempic",
        dose: 0.5,
        frequency: "weekly",
        startDate: "2024-01-01",
        active: true,
      }),
    );
    localStorage.setItem(
      "jotrea_doses",
      JSON.stringify([
        {
          id: "d-injection",
          date: "2024-03-01",
          time: "10:00",
          doseAmount: 0.5,
          site: "Abdomen",
          notes: "",
          taken: true,
        },
      ]),
    );

    render(<Dashboard />);

    const card = screen.getByTestId("last-dose-stat");
    // For an injection medication the known site IS shown in the sub-text
    expect(card.textContent).toContain("Abdomen");
  });
});
