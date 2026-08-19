/**
 * Prescription-check regression tests
 *
 * Asserts that dose confirmation screens show neutral tracking language for
 * every medication instead of medication-use or dosage guidance.
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";

const PRESCRIPTION_CHECK =
  "Confirm that this medication and dose match your prescription. Jotrea records your entry; it does not recommend or change dosages.";

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

describe("Dashboard – prescription check after logging a dose", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the neutral prescription check for Ozempic", () => {
    seedOzempic();
    render(<Dashboard />);

    // Open the log form
    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // Submit the dose
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    // Confirmation screen should appear with neutral tracker-only language.
    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(PRESCRIPTION_CHECK);
  });

  it("shows the neutral prescription check for a custom medication", () => {
    seedCustomMedication();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(PRESCRIPTION_CHECK);
  });

  it("shows the neutral prescription check for Wegovy", () => {
    seedWegovy();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(PRESCRIPTION_CHECK);
  });

  it("shows the neutral prescription check for Mounjaro", () => {
    seedMounjaro();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(PRESCRIPTION_CHECK);
  });

  it("shows the neutral prescription check for Rybelsus", () => {
    seedRybelsus();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(PRESCRIPTION_CHECK);
  });
});

// ---------------------------------------------------------------------------
// DoseLog – log flow
// ---------------------------------------------------------------------------

describe("DoseLog – prescription check after logging a dose", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the neutral prescription check for Ozempic", () => {
    seedOzempic();
    render(<DoseLog />);

    // Open the add-dose sheet via the header Add button
    fireEvent.click(screen.getByTestId("add-dose-btn"));

    // Submit
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(PRESCRIPTION_CHECK);
  });

  it("shows the neutral prescription check for a custom medication", () => {
    seedCustomMedication();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(PRESCRIPTION_CHECK);
  });

  it("shows the neutral prescription check for Wegovy", () => {
    seedWegovy();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(PRESCRIPTION_CHECK);
  });

  it("shows the neutral prescription check for Mounjaro", () => {
    seedMounjaro();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(PRESCRIPTION_CHECK);
  });

  it("shows the neutral prescription check for Rybelsus", () => {
    seedRybelsus();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    const noteEl = screen.getByTestId("pharmacist-note-text");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl.textContent).toBe(PRESCRIPTION_CHECK);
  });
});
