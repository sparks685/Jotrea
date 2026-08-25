/**
 * Motivation reminder persistence — regression tests
 *
 * Confirms two production-critical behaviours for the "Why you started" banner
 * on the Dashboard:
 *
 *   1. Dismiss-then-reload: after the user dismisses the banner, remounting
 *      Dashboard (simulating a page reload) must NOT re-show it.
 *
 *   2. Pre-dismissed: when `jotrea_why_dismissed` is already `true` in
 *      localStorage at mount time the banner must never render at all.
 *
 * The key is `jotrea_why_dismissed` (Dashboard.tsx line 73).
 */

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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
  isNotificationSupported: () => true,
  getNotificationPermission: vi.fn().mockResolvedValue("default"),
  rescheduleAllNotifications: vi.fn(),
  cancelNotificationTag: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import subject AFTER mocks are registered
// ---------------------------------------------------------------------------

import Dashboard from "@/pages/Dashboard";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";
const USER_KEY = "jotrea_user";
const WHY_DISMISSED_KEY = "jotrea_why_dismissed";

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/** Seeds a weekly injection medication (Ozempic). */
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

/**
 * Seeds the user with motivations and a glpStartDate that puts them within
 * the first 12 weeks of treatment (so the banner is eligible to show).
 */
function seedUserWithMotivations() {
  const recentStartDate = new Date();
  recentStartDate.setDate(recentStartDate.getDate() - 14); // 2 weeks ago
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      name: "Test User",
      units: "lbs",
      subscription: "free",
      glpStartDate: recentStartDate.toISOString().split("T")[0],
      motivations: ["Lose weight for my health", "Feel more energetic"],
    }),
  );
}

// ---------------------------------------------------------------------------
// 1. Dismiss-then-reload: banner must not reappear after the user dismisses it
// ---------------------------------------------------------------------------

describe("motivation banner: dismiss then reload", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
    seedUserWithMotivations();
  });

  it("shows the banner on first mount when conditions are met", () => {
    render(<Dashboard />);
    expect(screen.getByTestId("why-banner")).toBeInTheDocument();
  });

  it("hides the banner immediately after the user dismisses it", () => {
    render(<Dashboard />);

    const dismissBtn = screen.getByTestId("dismiss-why-banner");
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });

  it("persists the dismissed state to localStorage when dismiss is clicked", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("dismiss-why-banner"));

    const stored = localStorage.getItem(WHY_DISMISSED_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toBe(true);
  });

  it("does NOT show the banner after a simulated page reload (component remount)", () => {
    // First mount: dismiss the banner
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId("dismiss-why-banner"));

    // Simulate a page reload by unmounting and remounting the component.
    // localStorage state (jotrea_why_dismissed = true) persists across the remount.
    cleanup();
    render(<Dashboard />);

    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Pre-dismissed: banner must never appear when the key is already true
// ---------------------------------------------------------------------------

describe("motivation banner: pre-dismissed at mount", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
    seedUserWithMotivations();
    // Simulate a previous session where the user already dismissed the banner
    localStorage.setItem(WHY_DISMISSED_KEY, JSON.stringify(true));
  });

  it("never renders the banner when jotrea_why_dismissed is true at mount", () => {
    render(<Dashboard />);
    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });

  it("keeps the banner hidden across multiple re-renders", () => {
    const { rerender } = render(<Dashboard />);
    rerender(<Dashboard />);
    rerender(<Dashboard />);
    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Edge cases
// ---------------------------------------------------------------------------

describe("motivation banner: edge cases", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
  });

  it("does not show the banner when there are no motivations, even if not dismissed", () => {
    const recentStartDate = new Date();
    recentStartDate.setDate(recentStartDate.getDate() - 14);
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        name: "Test User",
        units: "lbs",
        subscription: "free",
        glpStartDate: recentStartDate.toISOString().split("T")[0],
        motivations: [], // empty array → banner must not show
      }),
    );

    render(<Dashboard />);
    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });

  it("does not show the banner when glpStartDate is beyond 12 weeks ago", () => {
    const oldStartDate = new Date();
    oldStartDate.setDate(oldStartDate.getDate() - 7 * 13); // 13 weeks ago
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        name: "Test User",
        units: "lbs",
        subscription: "free",
        glpStartDate: oldStartDate.toISOString().split("T")[0],
        motivations: ["Lose weight for my health"],
      }),
    );

    render(<Dashboard />);
    expect(screen.queryByTestId("why-banner")).not.toBeInTheDocument();
  });
});
