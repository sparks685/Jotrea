/**
 * Motivations post-dismissal sync — regression tests
 *
 * Documents and locks in the intentional product behaviour:
 *
 *   When a user has already dismissed the "Why you started" banner
 *   (jotrea_why_dismissed === true) and later edits their motivations in
 *   Settings, the dismissed flag is NOT reset. The banner stays hidden even
 *   though the motivations list has changed.
 *
 * Rationale: dismissal is a deliberate user action. Editing motivations is a
 * separate action in a different screen. Re-surfacing the banner after every
 * motivation edit would be intrusive and would violate the user's intent.
 *
 * If the product decision ever changes (i.e. fresh motivations should
 * resurface the banner), these tests will fail loudly as a forcing function to
 * update the implementation and document the new behaviour.
 *
 * Key files:
 *   - artifacts/jotrea/src/pages/Dashboard.tsx  — banner logic + jotrea_why_dismissed
 *   - artifacts/jotrea/src/pages/Settings.tsx   — toggleMotivation writes jotrea_user
 */

import { render, screen, act, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks — declared before any import that triggers them
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

vi.mock("@/utils/notifications", () => ({
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
const WHY_DISMISSED_KEY = "jotrea_why_dismissed";

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

/** Seeds user with motivations and a start-date within the first 12 weeks. */
function seedUserWithMotivations(motivations: string[] = ["Feel more confident"]) {
  const recentStartDate = new Date();
  recentStartDate.setDate(recentStartDate.getDate() - 14); // 2 weeks ago
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      name: "Test User",
      units: "lbs",
      subscription: "free",
      glpStartDate: recentStartDate.toISOString().split("T")[0],
      motivations,
    }),
  );
}

/**
 * Simulates what Settings.tsx's toggleMotivation does under the hood:
 * writes an updated jotrea_user to localStorage and dispatches a synthetic
 * StorageEvent so Dashboard's useLocalStorage hook picks up the change.
 */
function simulateMotivationEdit(newMotivations: string[]) {
  const existing = JSON.parse(localStorage.getItem(USER_KEY) ?? "{}");
  const updated = { ...existing, motivations: newMotivations };
  const serialized = JSON.stringify(updated);
  localStorage.setItem(USER_KEY, serialized);
  window.dispatchEvent(
    new StorageEvent("storage", { key: USER_KEY, newValue: serialized }),
  );
}

// ---------------------------------------------------------------------------
// 1. Banner stays hidden after dismissal, even when motivations are edited
// ---------------------------------------------------------------------------

describe("motivations post-dismissal: banner stays hidden after edit", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
    seedUserWithMotivations(["Feel more confident"]);
    // The user has already dismissed the banner in a previous session
    localStorage.setItem(WHY_DISMISSED_KEY, JSON.stringify(true));
  });

  it("does not show the banner at mount when dismissed flag is set", () => {
    render(<Dashboard />);
    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });

  it("still does not show the banner after a motivation is added via Settings", () => {
    render(<Dashboard />);

    act(() => {
      simulateMotivationEdit(["Feel more confident", "Improve my health"]);
    });

    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });

  it("still does not show the banner after a motivation is removed via Settings", () => {
    render(<Dashboard />);

    act(() => {
      simulateMotivationEdit([]); // user removed their only motivation
    });

    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });

  it("still does not show the banner after motivations are completely replaced", () => {
    render(<Dashboard />);

    act(() => {
      simulateMotivationEdit(["Fresh start", "Boost my energy", "Feel good in my clothes"]);
    });

    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. jotrea_why_dismissed flag is not modified by motivation edits
// ---------------------------------------------------------------------------

describe("motivations post-dismissal: dismissed flag is not touched by Settings writes", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
    seedUserWithMotivations(["Feel more confident"]);
    localStorage.setItem(WHY_DISMISSED_KEY, JSON.stringify(true));
  });

  it("jotrea_why_dismissed remains true after a motivation is added", () => {
    render(<Dashboard />);

    act(() => {
      simulateMotivationEdit(["Feel more confident", "Special event coming up"]);
    });

    const stored = localStorage.getItem(WHY_DISMISSED_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toBe(true);
  });

  it("jotrea_why_dismissed remains true after motivations are cleared", () => {
    render(<Dashboard />);

    act(() => {
      simulateMotivationEdit([]);
    });

    const stored = localStorage.getItem(WHY_DISMISSED_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toBe(true);
  });

  it("jotrea_why_dismissed remains true across multiple successive edits", () => {
    render(<Dashboard />);

    act(() => { simulateMotivationEdit(["Fresh start"]); });
    act(() => { simulateMotivationEdit(["Fresh start", "Boost my energy"]); });
    act(() => { simulateMotivationEdit(["Boost my energy"]); });

    const stored = localStorage.getItem(WHY_DISMISSED_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Banner stays hidden after dismissal + remount (simulated page reload)
//    even when motivations have been updated between sessions
// ---------------------------------------------------------------------------

describe("motivations post-dismissal: dismissed state survives remount after edit", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
  });

  it("banner does not reappear on remount when motivations were updated while dismissed", () => {
    // Session 1: user has motivations and has previously dismissed the banner
    seedUserWithMotivations(["Feel more confident"]);
    localStorage.setItem(WHY_DISMISSED_KEY, JSON.stringify(true));

    // Between sessions, the user edited their motivations in Settings
    // (write directly — no component mounted)
    simulateMotivationEdit(["Feel more confident", "Fresh start", "Improve my health"]);

    // Session 2: user opens the app (remount); banner must stay hidden
    render(<Dashboard />);
    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });

  it("banner does not reappear on remount when motivations were cleared while dismissed", () => {
    seedUserWithMotivations(["Feel more confident"]);
    localStorage.setItem(WHY_DISMISSED_KEY, JSON.stringify(true));

    simulateMotivationEdit([]);

    cleanup();
    render(<Dashboard />);
    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Baseline: banner DOES appear (undismissed) when motivations are added
//    — confirms the test setup is correct and the flag is the only gate
// ---------------------------------------------------------------------------

describe("motivations post-dismissal: baseline — banner responds normally without dismissed flag", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
    // No dismissed flag set — fresh state
  });

  it("banner shows when motivations exist and banner has not been dismissed", () => {
    seedUserWithMotivations(["Feel more confident"]);
    render(<Dashboard />);
    expect(screen.getByTestId("why-banner")).toBeInTheDocument();
  });

  it("banner appears after motivations are added via Settings when never dismissed", () => {
    // Start with no motivations → banner hidden
    seedUserWithMotivations([]);
    render(<Dashboard />);
    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();

    // Settings adds motivations
    act(() => {
      simulateMotivationEdit(["Fresh start"]);
    });

    // Banner should now be visible (motivations present, not dismissed)
    expect(screen.getByTestId("why-banner")).toBeInTheDocument();
  });

  it("banner disappears after motivations are removed via Settings when never dismissed", () => {
    seedUserWithMotivations(["Feel more confident"]);
    render(<Dashboard />);
    expect(screen.getByTestId("why-banner")).toBeInTheDocument();

    act(() => {
      simulateMotivationEdit([]);
    });

    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });
});
