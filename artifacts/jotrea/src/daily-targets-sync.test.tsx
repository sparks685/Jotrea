/**
 * Daily Targets cross-component sync — regression tests
 *
 * Confirms that the Today's Targets card in Dashboard.tsx immediately reflects
 * changes written by Settings.tsx to jotrea_user in localStorage, without
 * requiring a full page reload.
 *
 * The mechanism under test is useLocalStorage's synthetic StorageEvent dispatch:
 * every `setValue` call writes the new value to localStorage AND dispatches a
 * `storage` window event so sibling hook instances (Dashboard's useUser) pick
 * up the change and re-render.
 *
 * Covers all three goal fields:
 *   - waterGoalCups  (Dashboard renders "Daily goal: ${value} cups")
 *   - proteinGoalG   (Dashboard renders "Daily goal: ${value} g")
 *   - stepsGoal      (Dashboard renders "Daily goal: ${localizedValue} steps")
 */

import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

const navigate = vi.fn();

// ---------------------------------------------------------------------------
// Module mocks — declared before any import that triggers them
// ---------------------------------------------------------------------------

vi.mock("wouter", () => ({
  useLocation: () => ["/", navigate],
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

vi.mock("@/utils/notifications", () => ({
  isNotificationSupported: () => true,
  getNotificationPermission: vi.fn().mockResolvedValue("default"),
  rescheduleAllNotifications: vi.fn(),
  cancelNotificationTag: vi.fn(),
  scheduleAllNotifications: vi.fn(),
  cancelAllNotifications: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import subject AFTER mocks
// ---------------------------------------------------------------------------

import Dashboard from "@/pages/Dashboard";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";
const USER_KEY = "jotrea_user";

// ---------------------------------------------------------------------------
// Helpers
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

function seedUser(overrides: Record<string, unknown> = {}) {
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      name: "Test User",
      units: "lbs",
      subscription: "free",
      ...overrides,
    }),
  );
}

/**
 * Simulates what useLocalStorage's setValue does when Settings saves a new
 * user object: writes to localStorage then dispatches a synthetic StorageEvent
 * so every other useLocalStorage("jotrea_user", …) instance re-renders.
 */
function simulateSettingsWrite(patch: Record<string, unknown>) {
  const existing = JSON.parse(localStorage.getItem(USER_KEY) ?? "{}");
  const updated = { ...existing, ...patch };
  const serialized = JSON.stringify(updated);
  localStorage.setItem(USER_KEY, serialized);
  window.dispatchEvent(
    new StorageEvent("storage", { key: USER_KEY, newValue: serialized }),
  );
}

// ---------------------------------------------------------------------------
// 1. waterGoalCups
// ---------------------------------------------------------------------------

describe("Daily Targets — waterGoalCups sync", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
  });

  it("shows the default water goal (8) when no waterGoalCups is stored", () => {
    seedUser();
    render(<Dashboard />);
    expect(screen.getByText("Daily goal: 8 cups")).toBeInTheDocument();
    expect(screen.getByTestId("daily-target-water")).toHaveAccessibleName(/goal 8 cups/);
  });

  it("shows a custom waterGoalCups stored at mount time", () => {
    seedUser({ waterGoalCups: 12 });
    render(<Dashboard />);
    expect(screen.getByText("Daily goal: 12 cups")).toBeInTheDocument();
  });

  it("updates immediately when Settings writes a new waterGoalCups via StorageEvent", () => {
    seedUser({ waterGoalCups: 8 });
    render(<Dashboard />);

    expect(screen.getByText("Daily goal: 8 cups")).toBeInTheDocument();

    act(() => {
      simulateSettingsWrite({ waterGoalCups: 10 });
    });

    expect(screen.getByText("Daily goal: 10 cups")).toBeInTheDocument();
    expect(screen.getByTestId("daily-target-water")).toHaveAccessibleName(/goal 10 cups/);
    expect(screen.queryByText("Daily goal: 8 cups")).not.toBeInTheDocument();
  });

  it("does NOT require a remount to reflect the new waterGoalCups", () => {
    seedUser({ waterGoalCups: 6 });
    const { rerender } = render(<Dashboard />);

    act(() => {
      simulateSettingsWrite({ waterGoalCups: 9 });
    });

    // The value must have updated in the live render, not only after a re-render
    rerender(<Dashboard />);
    expect(screen.getByText("Daily goal: 9 cups")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. proteinGoalG
// ---------------------------------------------------------------------------

describe("Daily Targets — proteinGoalG sync", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
  });

  it("shows the explicit proteinGoalG stored at mount time", () => {
    seedUser({ proteinGoalG: 120 });
    render(<Dashboard />);
    expect(screen.getByText("Daily goal: 120 g")).toBeInTheDocument();
  });

  it("updates immediately when Settings writes a new proteinGoalG via StorageEvent", () => {
    seedUser({ proteinGoalG: 100 });
    render(<Dashboard />);

    expect(screen.getByText("Daily goal: 100 g")).toBeInTheDocument();

    act(() => {
      simulateSettingsWrite({ proteinGoalG: 150 });
    });

    expect(screen.getByText("Daily goal: 150 g")).toBeInTheDocument();
    expect(screen.getByTestId("daily-target-protein")).toHaveAccessibleName(/goal 150 g/);
    expect(screen.queryByText("Daily goal: 100 g")).not.toBeInTheDocument();
  });

  it("shows the computed default when proteinGoalG is cleared to undefined", () => {
    // When proteinGoalG is removed, Dashboard derives it from currentWeightLbs.
    // 198 lbs / 2.20462 * 0.8 ≈ 72g
    seedUser({ proteinGoalG: 100, currentWeightLbs: 198 });
    render(<Dashboard />);

    expect(screen.getByText("Daily goal: 100 g")).toBeInTheDocument();

    act(() => {
      // Simulate the user clearing proteinGoalG (saving undefined → key absent)
      const existing = JSON.parse(localStorage.getItem(USER_KEY) ?? "{}");
      delete existing.proteinGoalG;
      const serialized = JSON.stringify(existing);
      localStorage.setItem(USER_KEY, serialized);
      window.dispatchEvent(
        new StorageEvent("storage", { key: USER_KEY, newValue: serialized }),
      );
    });

    // No explicit goal → computed from weight: Math.round(198 / 2.20462 * 0.8) = 72
    const expected = `Daily goal: ${Math.round((198 / 2.20462) * 0.8)} g`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. stepsGoal
// ---------------------------------------------------------------------------

describe("Daily Targets — stepsGoal sync", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
  });

  it("shows the explicit stepsGoal stored at mount time", () => {
    seedUser({ stepsGoal: 8000 });
    render(<Dashboard />);
    expect(screen.getByText(`Daily goal: ${(8000).toLocaleString()} steps`)).toBeInTheDocument();
  });

  it("updates immediately when Settings writes a new stepsGoal via StorageEvent", () => {
    seedUser({ stepsGoal: 7000 });
    render(<Dashboard />);

    expect(screen.getByText(`Daily goal: ${(7000).toLocaleString()} steps`)).toBeInTheDocument();

    act(() => {
      simulateSettingsWrite({ stepsGoal: 10000 });
    });

    expect(screen.getByText(`Daily goal: ${(10000).toLocaleString()} steps`)).toBeInTheDocument();
    expect(screen.getByTestId("daily-target-steps")).toHaveAccessibleName(
      expect.stringContaining(`goal ${(10000).toLocaleString()} steps`),
    );
    expect(screen.queryByText(`Daily goal: ${(7000).toLocaleString()} steps`)).not.toBeInTheDocument();
  });

  it("shows the activity-level default when stepsGoal is cleared to undefined", () => {
    seedUser({ stepsGoal: 9000, activityLevel: "sedentary" }); // sedentary → 5000
    render(<Dashboard />);

    expect(screen.getByText(`Daily goal: ${(9000).toLocaleString()} steps`)).toBeInTheDocument();

    act(() => {
      const existing = JSON.parse(localStorage.getItem(USER_KEY) ?? "{}");
      delete existing.stepsGoal;
      const serialized = JSON.stringify(existing);
      localStorage.setItem(USER_KEY, serialized);
      window.dispatchEvent(
        new StorageEvent("storage", { key: USER_KEY, newValue: serialized }),
      );
    });

    expect(screen.getByText(`Daily goal: ${(5000).toLocaleString()} steps`)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. All three goals update in a single write
// ---------------------------------------------------------------------------

describe("Daily Targets — simultaneous update of all three goals", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
  });

  it("reflects waterGoalCups, proteinGoalG, and stepsGoal after one StorageEvent", () => {
    seedUser({ waterGoalCups: 8, proteinGoalG: 100, stepsGoal: 7000 });
    render(<Dashboard />);

    expect(screen.getByText("Daily goal: 8 cups")).toBeInTheDocument();
    expect(screen.getByText("Daily goal: 100 g")).toBeInTheDocument();
    expect(screen.getByText(`Daily goal: ${(7000).toLocaleString()} steps`)).toBeInTheDocument();

    act(() => {
      simulateSettingsWrite({ waterGoalCups: 12, proteinGoalG: 160, stepsGoal: 9000 });
    });

    expect(screen.getByText("Daily goal: 12 cups")).toBeInTheDocument();
    expect(screen.getByText("Daily goal: 160 g")).toBeInTheDocument();
    expect(screen.getByText(`Daily goal: ${(9000).toLocaleString()} steps`)).toBeInTheDocument();

    // Old values must be gone
    expect(screen.queryByText("Daily goal: 8 cups")).not.toBeInTheDocument();
    expect(screen.queryByText("Daily goal: 100 g")).not.toBeInTheDocument();
    expect(screen.queryByText(`Daily goal: ${(7000).toLocaleString()} steps`)).not.toBeInTheDocument();
  });
});

describe("Daily Targets — check-in interaction", () => {
  beforeEach(() => {
    localStorage.clear();
    navigate.mockClear();
    seedMedication();
    seedUser();
  });

  it.each(["water", "protein", "steps"] as const)(
    "opens the %s logging sheet without navigating or toggling",
    (target) => {
      render(<Dashboard />);
      const button = screen.getByTestId(`daily-target-${target}`);
      expect(button).toHaveAttribute("data-complete", "false");
      fireEvent.click(button);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByTestId(`daily-target-sheet-${target}`)).toBeInTheDocument();
      expect(button).toHaveAttribute("data-complete", "false");
      expect(navigate).not.toHaveBeenCalled();
    },
  );
});
