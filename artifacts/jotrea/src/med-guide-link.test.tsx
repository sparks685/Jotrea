/**
 * "View medication guide" link regression tests
 *
 * Confirms that:
 *   1. Clicking the link on the Dashboard confirmation screen calls
 *      navigate("/med-info") and dismisses the dose-log sheet.
 *   2. Clicking the link on the DoseLog calendar confirmation screen does
 *      the same.
 *   3. After a medication change, MedInfo renders the updated medication's
 *      brand name — not the previous one.
 *
 * Covers the full "log dose → confirm → click link → med-info" journey for
 * both entry points, plus the med-info page's response to a medication swap.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted runs before the vi.mock factory, so we can
// reference these stubs inside the mock factories safely.
// ---------------------------------------------------------------------------

const mockNavigate = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Module mocks — declared before any subject import
// ---------------------------------------------------------------------------

vi.mock("wouter", () => ({
  useLocation: () => ["/", mockNavigate],
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
// Import subjects AFTER mocks
// ---------------------------------------------------------------------------

import Dashboard from "@/pages/Dashboard";
import DoseLog from "@/pages/DoseLog";
import MedInfo from "@/pages/MedInfo";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";

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

function seedMounjaro() {
  seedMedication("tirzepatide-mounjaro", "Mounjaro", 2.5, "Tirzepatide");
}

function seedWegovy() {
  seedMedication("semaglutide-wegovy", "Wegovy", 0.25);
}

// ---------------------------------------------------------------------------
// Dashboard — "View medication guide" link
// ---------------------------------------------------------------------------

describe("Dashboard – 'View medication guide' link", () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
  });

  it("is present on the dose confirmation screen after logging a dose", () => {
    seedOzempic();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    expect(screen.getByTestId("view-med-guide-link")).toBeInTheDocument();
  });

  it("calls navigate('/med-info') when clicked", () => {
    seedOzempic();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    fireEvent.click(screen.getByTestId("view-med-guide-link"));

    expect(mockNavigate).toHaveBeenCalledWith("/med-info");
  });

  it("closes the dose-log sheet after clicking the link", () => {
    seedOzempic();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    // Confirm screen is visible
    expect(screen.getByTestId("dose-confirm-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("view-med-guide-link"));

    // Sheet (and the confirm screen inside it) should be gone
    expect(screen.queryByTestId("dose-confirm-screen")).not.toBeInTheDocument();
  });

  it("navigates to /med-info after a medication change (Ozempic → Mounjaro)", () => {
    // Simulate: user was on Ozempic, then changed to Mounjaro before logging
    seedMounjaro();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    fireEvent.click(screen.getByTestId("view-med-guide-link"));

    // Navigate target is always /med-info regardless of which medication
    expect(mockNavigate).toHaveBeenCalledWith("/med-info");
  });

  it("navigates to /med-info after a medication change (Ozempic → Wegovy)", () => {
    seedWegovy();
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    fireEvent.click(screen.getByTestId("view-med-guide-link"));

    expect(mockNavigate).toHaveBeenCalledWith("/med-info");
  });
});

// ---------------------------------------------------------------------------
// DoseLog — "View medication guide" link
// ---------------------------------------------------------------------------

describe("DoseLog – 'View medication guide' link", () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
  });

  it("is present on the dose confirmation screen after logging a dose", () => {
    seedOzempic();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    expect(screen.getByTestId("view-med-guide-link")).toBeInTheDocument();
  });

  it("calls navigate('/med-info') when clicked", () => {
    seedOzempic();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    fireEvent.click(screen.getByTestId("view-med-guide-link"));

    expect(mockNavigate).toHaveBeenCalledWith("/med-info");
  });

  it("closes the add-dose sheet after clicking the link", () => {
    seedOzempic();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    // Confirm screen is visible
    expect(screen.getByTestId("dose-confirm-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("view-med-guide-link"));

    // Sheet (and the confirm screen inside it) should be gone
    expect(screen.queryByTestId("dose-confirm-screen")).not.toBeInTheDocument();
  });

  it("navigates to /med-info after a medication change (Ozempic → Mounjaro)", () => {
    seedMounjaro();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    fireEvent.click(screen.getByTestId("view-med-guide-link"));

    expect(mockNavigate).toHaveBeenCalledWith("/med-info");
  });

  it("navigates to /med-info after a medication change (Ozempic → Wegovy)", () => {
    seedWegovy();
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));
    fireEvent.click(screen.getByTestId("save-dose-btn"));

    fireEvent.click(screen.getByTestId("view-med-guide-link"));

    expect(mockNavigate).toHaveBeenCalledWith("/med-info");
  });
});

// ---------------------------------------------------------------------------
// MedInfo — destination page reflects the current medication after a change
// ---------------------------------------------------------------------------

describe("MedInfo – shows updated medication after a change", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows Ozempic info when Ozempic is the active medication", () => {
    seedOzempic();
    render(<MedInfo />);

    // Brand name appears in the medication card header
    expect(screen.getByText("Ozempic")).toBeInTheDocument();
    // Generic name
    expect(screen.getByText("Semaglutide")).toBeInTheDocument();
  });

  it("shows Mounjaro info (not Ozempic) after switching to Mounjaro", () => {
    // Simulate the user having changed medication to Mounjaro
    seedMounjaro();
    render(<MedInfo />);

    expect(screen.getByText("Mounjaro")).toBeInTheDocument();
    // Tirzepatide is Mounjaro's generic name
    expect(screen.getByText("Tirzepatide")).toBeInTheDocument();
    // Must NOT show the old medication
    expect(screen.queryByText("Ozempic")).not.toBeInTheDocument();
  });

  it("shows Wegovy info (not Ozempic) after switching to Wegovy", () => {
    seedWegovy();
    render(<MedInfo />);

    expect(screen.getByText("Wegovy")).toBeInTheDocument();
    expect(screen.queryByText("Ozempic")).not.toBeInTheDocument();
  });

  it("shows the Dosing Tips section open by default", () => {
    seedOzempic();
    render(<MedInfo />);

    // The "dosing" section is open by default (openSection initialised to "dosing")
    expect(screen.getByTestId("section-dosing")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-section-dosing")).toBeInTheDocument();
  });

  it("current dose on the med-info card matches the active medication's dose after a change", () => {
    // After switching to Mounjaro at 2.5 mg, the med-info page should reflect that
    seedMounjaro();
    render(<MedInfo />);

    // The card shows "Current Dose" — value is "2.5 mg"
    expect(screen.getByText("2.5 mg")).toBeInTheDocument();
  });
});
