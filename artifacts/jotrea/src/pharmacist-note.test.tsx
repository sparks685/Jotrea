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

const WEGOVY = medications.find((m) => m.id === "semaglutide-wegovy")!;
const WEGOVY_NOTE = WEGOVY.pharmacistNote;

const MOUNJARO = medications.find((m) => m.id === "tirzepatide-mounjaro")!;
const MOUNJARO_NOTE = MOUNJARO.pharmacistNote;

const RYBELSUS = medications.find((m) => m.id === "semaglutide-rybelsus")!;
const RYBELSUS_NOTE = RYBELSUS.pharmacistNote;

const GENERIC_NOTE =
  "Take your medication exactly as prescribed. Always rotate injection sites, store as directed on the label, and never double dose if you miss one. When in doubt, ask your pharmacist.";

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function seedMedication(
  id: string,
  brandName: string,
  dose: number,
  genericName = "Semaglutide",
  frequency = "weekly",
) {
  localStorage.setItem(
    MEDICATION_KEY,
    JSON.stringify({
      id,
      genericName,
      brandName,
      dose,
      frequency,
      startDate: "2024-01-01",
      active: true,
    }),
  );
}

function seedOzempic() {
  seedMedication("semaglutide-ozempic", "Ozempic", 0.5);
}

function seedWegovy() {
  seedMedication("semaglutide-wegovy", "Wegovy", 0.25);
}

function seedMounjaro() {
  seedMedication("tirzepatide-mounjaro", "Mounjaro", 2.5, "Tirzepatide");
}

function seedRybelsus() {
  seedMedication("semaglutide-rybelsus", "Rybelsus", 3, "Semaglutide", "daily");
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

  it("shows the Wegovy-specific pharmacist note after logging a dose", () => {
    seedWegovy();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(WEGOVY_NOTE);
  });

  it("shows the Mounjaro-specific pharmacist note after logging a dose", () => {
    seedMounjaro();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(MOUNJARO_NOTE);
  });

  it("shows the Rybelsus-specific pharmacist note after logging a dose", () => {
    seedRybelsus();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(RYBELSUS_NOTE);
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

  it("shows the Wegovy-specific pharmacist note after logging a dose", () => {
    seedWegovy();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(WEGOVY_NOTE);
  });

  it("shows the Mounjaro-specific pharmacist note after logging a dose", () => {
    seedMounjaro();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(MOUNJARO_NOTE);
  });

  it("shows the Rybelsus-specific pharmacist note after logging a dose", () => {
    seedRybelsus();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(RYBELSUS_NOTE);
  });
});
