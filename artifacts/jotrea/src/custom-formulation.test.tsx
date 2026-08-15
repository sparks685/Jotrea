/**
 * Custom medication formulation — end-to-end verification
 *
 * Covers the two custom-medication branches:
 *
 *   - Custom injection  (medication.injectionSite !== undefined):
 *       • DoseLog shows the injection site picker
 *       • dose is saved with the chosen site
 *
 *   - Custom oral  (medication.id === "custom", no injectionSite):
 *       • DoseLog hides the injection site picker
 *       • dose is saved with site: "oral"
 *
 *   - Settings injection-history section:
 *       • appears when any dose has a non-oral site
 *       • hidden when all doses have site === "oral" (or no doses at all)
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks
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

// DoseLog-specific mocks
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

// Settings-specific mocks
vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ permission: "default", requestPermission: vi.fn() }),
}));

vi.mock("@/components/ChangeMedicationSheet", () => ({
  ChangeMedicationSheet: () => null,
}));

vi.mock("@/utils/notifications", () => ({
  isNotificationSupported: () => true,
  scheduleAllNotifications: vi.fn(),
  cancelAllNotifications: vi.fn(),
  rescheduleAllNotifications: vi.fn(),
  getNextScheduledTime: vi.fn(() => null),
  cancelNotificationTag: vi.fn(),
}));

vi.mock("@/utils/featureGates", () => ({
  buildDoseCSV: vi.fn(() => ""),
  buildWeightCSV: vi.fn(() => ""),
  downloadCSV: vi.fn(),
}));

// AlertDialog primitives used in Settings
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: React.PropsWithChildren) => <>{children}</>,
  AlertDialogTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  AlertDialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogAction: ({ children, ...p }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => <button {...p}>{children}</button>,
  AlertDialogCancel: ({ children, ...p }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => <button {...p}>{children}</button>,
}));

// ---------------------------------------------------------------------------
// Import subjects AFTER mocks
// ---------------------------------------------------------------------------

import DoseLog from "@/pages/DoseLog";
import Settings from "@/pages/Settings";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";
const USER_KEY = "jotrea_user";
const DOSES_KEY = "jotrea_doses";

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function seedCustomInjectionMed() {
  localStorage.setItem(
    MEDICATION_KEY,
    JSON.stringify({
      id: "custom",
      genericName: "Custom Drug",
      brandName: "My Custom Injection",
      dose: 1,
      frequency: "weekly",
      startDate: "2024-01-01",
      active: true,
      injectionSite: "Abdomen",
    }),
  );
}

function seedCustomOralMed() {
  localStorage.setItem(
    MEDICATION_KEY,
    JSON.stringify({
      id: "custom",
      genericName: "Custom Drug",
      brandName: "My Custom Oral",
      dose: 1,
      frequency: "weekly",
      startDate: "2024-01-01",
      active: true,
      // no injectionSite → treated as oral
    }),
  );
}

function seedUser() {
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({ name: "Test", units: "lbs", subscription: "free" }),
  );
}

function seedDoses(doses: Array<Record<string, unknown>>) {
  localStorage.setItem(DOSES_KEY, JSON.stringify(doses));
}

function getStoredDoses(): Array<{ site?: string; [k: string]: unknown }> {
  const raw = localStorage.getItem(DOSES_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Array<{ site?: string; [k: string]: unknown }>;
}

// ---------------------------------------------------------------------------
// DoseLog — custom injection
// ---------------------------------------------------------------------------

describe("custom injection medication — DoseLog site picker", () => {
  beforeEach(() => {
    localStorage.clear();
    seedCustomInjectionMed();
    seedUser();
  });

  it("shows all four injection site buttons after opening the add form", () => {
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));

    expect(screen.queryByTestId("site-select-abdomen")).not.toBeNull();
    expect(screen.queryByTestId("site-select-thigh")).not.toBeNull();
    expect(screen.queryByTestId("site-select-upper-arm")).not.toBeNull();
    expect(screen.queryByTestId("site-select-buttocks")).not.toBeNull();
  });

  it("saves the selected injection site (non-oral) to the dose entry", () => {
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    // Switch to Thigh
    fireEvent.click(screen.getByTestId("site-select-thigh"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const doses = getStoredDoses();
    expect(doses.length).toBeGreaterThanOrEqual(1);
    expect(doses[doses.length - 1].site).toBe("Thigh");
  });

  it("pre-selects Abdomen (first site) when no prior injection doses exist", () => {
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));

    // Abdomen is the first site; it should be active (border-secondary class)
    const abdomenBtn = screen.getByTestId("site-select-abdomen");
    expect(abdomenBtn.className).toMatch(/border-secondary/);
  });

  it("pre-selects the next rotation site based on prior dose history", () => {
    // Seed a prior dose with Abdomen → next suggestion should be Thigh
    seedDoses([
      { id: "1", date: "2024-07-01", time: "09:00", doseAmount: 1, site: "Abdomen", notes: "", taken: true },
    ]);
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));

    const thighBtn = screen.getByTestId("site-select-thigh");
    expect(thighBtn.className).toMatch(/border-secondary/);

    const abdomenBtn = screen.getByTestId("site-select-abdomen");
    expect(abdomenBtn.className).not.toMatch(/border-secondary/);
  });
});

// ---------------------------------------------------------------------------
// DoseLog — custom oral
// ---------------------------------------------------------------------------

describe("custom oral medication — DoseLog site picker", () => {
  beforeEach(() => {
    localStorage.clear();
    seedCustomOralMed();
    seedUser();
  });

  it("hides the injection site picker after opening the add form", () => {
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));

    expect(screen.queryByTestId("site-select-abdomen")).toBeNull();
    expect(screen.queryByTestId("site-select-thigh")).toBeNull();
    expect(screen.queryByTestId("site-select-upper-arm")).toBeNull();
    expect(screen.queryByTestId("site-select-buttocks")).toBeNull();
  });

  it("saves 'oral' as the site to the dose entry", () => {
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const doses = getStoredDoses();
    expect(doses.length).toBeGreaterThanOrEqual(1);
    expect(doses[doses.length - 1].site).toBe("oral");
  });
});

// ---------------------------------------------------------------------------
// Settings — injection history section visibility
// ---------------------------------------------------------------------------

describe("Settings injection history section", () => {
  beforeEach(() => {
    localStorage.clear();
    seedUser();
  });

  it("shows the injection history section when doses include non-oral sites", () => {
    seedCustomInjectionMed();
    seedDoses([
      { id: "1", date: "2024-07-01", time: "09:00", doseAmount: 1, site: "Abdomen", notes: "", taken: true },
      { id: "2", date: "2024-07-08", time: "09:00", doseAmount: 1, site: "Thigh", notes: "", taken: true },
    ]);

    render(<Settings />);

    expect(screen.queryByText("Injection History")).not.toBeNull();
  });

  it("hides the injection history section when all doses have site 'oral'", () => {
    seedCustomOralMed();
    seedDoses([
      { id: "1", date: "2024-07-01", time: "09:00", doseAmount: 1, site: "oral", notes: "", taken: true },
      { id: "2", date: "2024-07-08", time: "09:00", doseAmount: 1, site: "oral", notes: "", taken: true },
    ]);

    render(<Settings />);

    expect(screen.queryByText("Injection History")).toBeNull();
  });

  it("hides the injection history section when there are no doses at all", () => {
    seedCustomOralMed();
    // No doses seeded

    render(<Settings />);

    expect(screen.queryByText("Injection History")).toBeNull();
  });

  it("shows injection history for a custom injection user and hides it for a custom oral user", () => {
    // Injection user
    seedCustomInjectionMed();
    seedDoses([
      { id: "1", date: "2024-07-01", time: "09:00", doseAmount: 1, site: "Upper Arm", notes: "", taken: true },
    ]);

    const { unmount } = render(<Settings />);
    expect(screen.queryByText("Injection History")).not.toBeNull();
    unmount();

    // Oral user — reset
    localStorage.clear();
    seedUser();
    seedCustomOralMed();
    seedDoses([
      { id: "1", date: "2024-07-01", time: "09:00", doseAmount: 1, site: "oral", notes: "", taken: true },
    ]);

    render(<Settings />);
    expect(screen.queryByText("Injection History")).toBeNull();
  });
});
