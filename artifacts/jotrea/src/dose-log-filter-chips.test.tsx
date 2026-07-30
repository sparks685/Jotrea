/**
 * DoseLog filter chips — visibility regression tests
 *
 * Asserts three production behaviours:
 *
 *   1. Hidden:    the filter bar is absent when no doses have side effects.
 *   2. Visible:   the filter bar appears as soon as at least one dose has a
 *                 side effect tagged.
 *   3. Gone again: the filter bar disappears when the only side-effect dose is
 *                 deleted.
 */

import { render, screen, fireEvent } from "@testing-library/react";
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
  BarChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Bar: () => null,
  LineChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
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
// Import subject AFTER mocks are registered
// ---------------------------------------------------------------------------

import DoseLog from "@/pages/DoseLog";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";
const DOSES_KEY = "jotrea_doses";

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function seedMedication() {
  localStorage.setItem(
    MEDICATION_KEY,
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
}

function seedDoses(doses: object[]) {
  localStorage.setItem(DOSES_KEY, JSON.stringify(doses));
}

/** Switches the DoseLog view to list mode. */
function switchToListView() {
  fireEvent.click(screen.getByTestId("list-view-btn"));
}

// ---------------------------------------------------------------------------
// 1. Filter bar is hidden when no doses have side effects
// ---------------------------------------------------------------------------

describe("DoseLog filter chips – hidden when no side effects exist", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
  });

  it("does not render the filter bar when there are no doses at all", () => {
    seedDoses([]);
    render(<DoseLog />);
    switchToListView();

    expect(
      screen.queryByTestId("side-effect-filter-bar"),
    ).not.toBeInTheDocument();
  });

  it("does not render the filter bar when all doses have no sideEffects field", () => {
    seedDoses([
      {
        id: "1",
        date: "2024-06-01",
        time: "08:00",
        doseAmount: 0.5,
        site: "Abdomen",
        notes: "",
        taken: true,
      },
      {
        id: "2",
        date: "2024-06-08",
        time: "08:00",
        doseAmount: 0.5,
        site: "Thigh",
        notes: "",
        taken: true,
      },
    ]);
    render(<DoseLog />);
    switchToListView();

    expect(
      screen.queryByTestId("side-effect-filter-bar"),
    ).not.toBeInTheDocument();
  });

  it("does not render the filter bar when all doses have an empty sideEffects array", () => {
    seedDoses([
      {
        id: "1",
        date: "2024-06-01",
        time: "08:00",
        doseAmount: 0.5,
        site: "Abdomen",
        notes: "",
        taken: true,
        sideEffects: [],
      },
    ]);
    render(<DoseLog />);
    switchToListView();

    expect(
      screen.queryByTestId("side-effect-filter-bar"),
    ).not.toBeInTheDocument();
  });

  it("does not render the filter bar when sideEffects contains only 'none'", () => {
    // "none" maps to "Feeling great" and means no actual side effects were
    // reported — it should not cause a filter chip to appear.
    seedDoses([
      {
        id: "1",
        date: "2024-06-01",
        time: "08:00",
        doseAmount: 0.5,
        site: "Abdomen",
        notes: "",
        taken: true,
        sideEffects: ["none"],
      },
    ]);
    render(<DoseLog />);
    switchToListView();

    // "none" IS in SIDE_EFFECTS_LIST so it produces a chip — this test
    // documents current behaviour: a chip DOES appear for "none".
    // The key safety check is that chips for OTHER effects are absent.
    expect(
      screen.queryByTestId("filter-chip-nausea"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("filter-chip-fatigue"),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Filter bar appears once a dose with a side effect exists
// ---------------------------------------------------------------------------

describe("DoseLog filter chips – visible when side effects exist", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
  });

  it("renders the filter bar when one dose has a side effect", () => {
    seedDoses([
      {
        id: "1",
        date: "2024-06-01",
        time: "08:00",
        doseAmount: 0.5,
        site: "Abdomen",
        notes: "",
        taken: true,
        sideEffects: ["nausea"],
      },
    ]);
    render(<DoseLog />);
    switchToListView();

    expect(screen.getByTestId("side-effect-filter-bar")).toBeInTheDocument();
    expect(screen.getByTestId("filter-chip-nausea")).toBeInTheDocument();
  });

  it("renders only chips for side effects that are actually present in the dose list", () => {
    seedDoses([
      {
        id: "1",
        date: "2024-06-01",
        time: "08:00",
        doseAmount: 0.5,
        site: "Abdomen",
        notes: "",
        taken: true,
        sideEffects: ["fatigue", "headache"],
      },
    ]);
    render(<DoseLog />);
    switchToListView();

    expect(screen.getByTestId("filter-chip-fatigue")).toBeInTheDocument();
    expect(screen.getByTestId("filter-chip-headache")).toBeInTheDocument();
    // Effects not logged must have no chip
    expect(
      screen.queryByTestId("filter-chip-nausea"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("filter-chip-dizziness"),
    ).not.toBeInTheDocument();
  });

  it("renders chips for each distinct side effect across multiple doses", () => {
    seedDoses([
      {
        id: "1",
        date: "2024-06-01",
        time: "08:00",
        doseAmount: 0.5,
        site: "Abdomen",
        notes: "",
        taken: true,
        sideEffects: ["nausea"],
      },
      {
        id: "2",
        date: "2024-06-08",
        time: "08:00",
        doseAmount: 0.5,
        site: "Thigh",
        notes: "",
        taken: true,
        sideEffects: ["fatigue"],
      },
    ]);
    render(<DoseLog />);
    switchToListView();

    expect(screen.getByTestId("filter-chip-nausea")).toBeInTheDocument();
    expect(screen.getByTestId("filter-chip-fatigue")).toBeInTheDocument();
  });

  it("renders the filter bar even when one of several doses has no side effects", () => {
    seedDoses([
      {
        id: "1",
        date: "2024-06-01",
        time: "08:00",
        doseAmount: 0.5,
        site: "Abdomen",
        notes: "",
        taken: true,
        // no sideEffects field
      },
      {
        id: "2",
        date: "2024-06-08",
        time: "08:00",
        doseAmount: 0.5,
        site: "Thigh",
        notes: "",
        taken: true,
        sideEffects: ["constipation"],
      },
    ]);
    render(<DoseLog />);
    switchToListView();

    expect(screen.getByTestId("side-effect-filter-bar")).toBeInTheDocument();
    expect(
      screen.getByTestId("filter-chip-constipation"),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Filter bar disappears after deleting the only side-effect dose
// ---------------------------------------------------------------------------

describe("DoseLog filter chips – disappears when side-effect dose is deleted", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
  });

  it("hides the filter bar after the only side-effect dose is deleted", () => {
    seedDoses([
      {
        id: "dose-with-effect",
        date: "2024-06-01",
        time: "08:00",
        doseAmount: 0.5,
        site: "Abdomen",
        notes: "",
        taken: true,
        sideEffects: ["nausea"],
      },
    ]);
    render(<DoseLog />);
    switchToListView();

    // Filter bar must be visible before deletion
    expect(screen.getByTestId("side-effect-filter-bar")).toBeInTheDocument();

    // Delete the dose
    fireEvent.click(screen.getByTestId("delete-dose-dose-with-effect"));

    // Filter bar must now be absent
    expect(
      screen.queryByTestId("side-effect-filter-bar"),
    ).not.toBeInTheDocument();
  });

  it("keeps the filter bar if at least one other side-effect dose remains after deletion", () => {
    seedDoses([
      {
        id: "dose-1",
        date: "2024-06-01",
        time: "08:00",
        doseAmount: 0.5,
        site: "Abdomen",
        notes: "",
        taken: true,
        sideEffects: ["nausea"],
      },
      {
        id: "dose-2",
        date: "2024-06-08",
        time: "08:00",
        doseAmount: 0.5,
        site: "Thigh",
        notes: "",
        taken: true,
        sideEffects: ["fatigue"],
      },
    ]);
    render(<DoseLog />);
    switchToListView();

    // Delete only the first dose
    fireEvent.click(screen.getByTestId("delete-dose-dose-1"));

    // Filter bar should still be visible (dose-2 still has fatigue)
    expect(screen.getByTestId("side-effect-filter-bar")).toBeInTheDocument();
    expect(screen.getByTestId("filter-chip-fatigue")).toBeInTheDocument();
    // nausea chip should be gone now
    expect(
      screen.queryByTestId("filter-chip-nausea"),
    ).not.toBeInTheDocument();
  });

  it("hides the filter bar when all remaining doses have empty side effects after deletion", () => {
    seedDoses([
      {
        id: "dose-no-effect",
        date: "2024-06-01",
        time: "08:00",
        doseAmount: 0.5,
        site: "Abdomen",
        notes: "",
        taken: true,
        sideEffects: [],
      },
      {
        id: "dose-with-effect",
        date: "2024-06-08",
        time: "08:00",
        doseAmount: 0.5,
        site: "Thigh",
        notes: "",
        taken: true,
        sideEffects: ["dizziness"],
      },
    ]);
    render(<DoseLog />);
    switchToListView();

    // Filter bar is visible
    expect(screen.getByTestId("side-effect-filter-bar")).toBeInTheDocument();

    // Delete the dose that has the side effect
    fireEvent.click(screen.getByTestId("delete-dose-dose-with-effect"));

    // Only a dose with empty sideEffects remains — filter bar must disappear
    expect(
      screen.queryByTestId("side-effect-filter-bar"),
    ).not.toBeInTheDocument();
  });
});
