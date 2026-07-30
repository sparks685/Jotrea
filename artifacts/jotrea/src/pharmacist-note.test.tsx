/**
 * Pharmacist note regression tests
 *
 * Asserts that the dose confirmation screen shows the correct pharmacist note
 * for a known medication (Ozempic) and the generic fallback for a custom
 * medication not found in the medications catalogue.
 *
 * Covers both the Dashboard (Home) log flow and the DoseLog (Calendar) log flow.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks – must be declared before any import that would trigger them
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
}));

vi.mock("@/components/CountdownRing", () => ({
  CountdownRing: () => <div data-testid="countdown-ring" />,
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  initGA: vi.fn(),
  pageView: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import subjects AFTER mocks are registered
// ---------------------------------------------------------------------------

import Dashboard from "@/pages/Dashboard";
import DoseLog from "@/pages/DoseLog";
import { medications } from "@/data/medications";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";

const OZEMPIC = medications.find((m) => m.id === "semaglutide-ozempic")!;
const OZEMPIC_NOTE = OZEMPIC.pharmacistNote;

const GENERIC_NOTE =
  "Take your medication exactly as prescribed. Always rotate injection sites, store as directed on the label, and never double dose if you miss one. When in doubt, ask your pharmacist.";

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function seedMedication(id: string, brandName: string, dose: number) {
  localStorage.setItem(
    MEDICATION_KEY,
    JSON.stringify({
      id,
      genericName: "Semaglutide",
      brandName,
      dose,
      frequency: "weekly",
      startDate: "2024-01-01",
      active: true,
    }),
  );
}

function seedOzempic() {
  seedMedication("semaglutide-ozempic", "Ozempic", 0.5);
}

function seedCustomMedication() {
  seedMedication("custom-medication-xyz", "My Custom Med", 1.0);
}

// ---------------------------------------------------------------------------
// Dashboard – log flow
// ---------------------------------------------------------------------------

describe("Dashboard – pharmacist note after logging a dose", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the Ozempic-specific pharmacist note after logging a dose", () => {
    seedOzempic();
    render(<Dashboard />);

    // Open the log form
    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // Submit the dose
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    // Confirmation screen should appear with the correct note
    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(OZEMPIC_NOTE);
  });

  it("shows the generic fallback note for a custom medication after logging a dose", () => {
    seedCustomMedication();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(GENERIC_NOTE);
  });
});

// ---------------------------------------------------------------------------
// DoseLog – log flow
// ---------------------------------------------------------------------------

describe("DoseLog – pharmacist note after logging a dose", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the Ozempic-specific pharmacist note after logging a dose", () => {
    seedOzempic();
    render(<DoseLog />);

    // Open the add-dose sheet via the header Add button
    fireEvent.click(screen.getByTestId("add-dose-btn"));

    // Submit
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(OZEMPIC_NOTE);
  });

  it("shows the generic fallback note for a custom medication after logging a dose", () => {
    seedCustomMedication();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(GENERIC_NOTE);
  });
});
