/**
 * Injection site history — behavioral regression tests
 *
 * Tests the real Dashboard component to confirm three production behaviours:
 *
 *   1. Pre-fill:  clicking "Log Dose" pre-selects the LAST site from
 *      injectionSiteHistory (Dashboard.tsx ~lines 266-270).
 *   2. Fallback:  when injectionSiteHistory is absent or empty the log form
 *      defaults to "Abdomen" (INJECTION_SITES[0]).
 *   3. Write-back: after the dose is confirmed, the chosen site is appended to
 *      injectionSiteHistory in localStorage (Dashboard.tsx ~lines 168-174).
 *
 * Test helpers mirror those in pharmacist-note.test.tsx so the testing
 * conventions stay consistent.
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
// Import subject AFTER mocks are registered
// ---------------------------------------------------------------------------

import Dashboard from "@/pages/Dashboard";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";
const USER_KEY = "jotrea_user";

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/** Seeds an injection-formulation medication (Ozempic). */
function seedInjectionMed() {
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

/** Seeds the user object with the supplied injectionSiteHistory array. */
function seedUser(injectionSiteHistory?: Array<{ site: string; date: string }>) {
  const user: Record<string, unknown> = { name: "Test User", units: "lbs", subscription: "free" };
  if (injectionSiteHistory !== undefined) {
    user.injectionSiteHistory = injectionSiteHistory;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Returns true if the site button (by testId) has the active "border-secondary" class. */
function isSiteActive(testId: string): boolean {
  const btn = screen.getByTestId(testId);
  return btn.className.includes("border-secondary");
}

/** Reads the persisted injectionSiteHistory from localStorage. */
function getStoredHistory(): Array<{ site: string; date: string }> {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as { injectionSiteHistory?: Array<{ site: string; date: string }> };
  return parsed.injectionSiteHistory ?? [];
}

// ---------------------------------------------------------------------------
// 1. Pre-fill: most-recent history entry is pre-selected
// ---------------------------------------------------------------------------

describe("injection site pre-fill from history", () => {
  beforeEach(() => {
    localStorage.clear();
    seedInjectionMed();
  });

  it("pre-selects the next rotation site after the last used site (Upper Arm → Buttocks)", () => {
    seedUser([
      { site: "Abdomen", date: "Jun 1" },
      { site: "Thigh", date: "Jun 8" },
      { site: "Upper Arm", date: "Jun 15" },
    ]);
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // Last used = Upper Arm (idx 2) → rotate to Buttocks (idx 3)
    expect(isSiteActive("log-site-buttocks")).toBe(true);
    // Others should not be active
    expect(isSiteActive("log-site-upper-arm")).toBe(false);
    expect(isSiteActive("log-site-abdomen")).toBe(false);
    expect(isSiteActive("log-site-thigh")).toBe(false);
  });

  it("wraps rotation back to Abdomen when last site was Buttocks", () => {
    seedUser([{ site: "Buttocks", date: "Jul 22" }]);
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // Last used = Buttocks (idx 3) → rotate to Abdomen (idx 0, wraps)
    expect(isSiteActive("log-site-abdomen")).toBe(true);
    expect(isSiteActive("log-site-buttocks")).toBe(false);
  });

  it("uses the last entry (not the first) to determine the next rotation site", () => {
    seedUser([
      { site: "Thigh", date: "Jul 1" },
      { site: "Buttocks", date: "Jul 8" },
    ]);
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // Last used = Buttocks (idx 3) → rotate to Abdomen (idx 0); Thigh is NOT the next site
    expect(isSiteActive("log-site-abdomen")).toBe(true);
    expect(isSiteActive("log-site-buttocks")).toBe(false);
    expect(isSiteActive("log-site-thigh")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Fallback to "Abdomen" when history is empty or absent
// ---------------------------------------------------------------------------

describe("injection site fallback to Abdomen", () => {
  beforeEach(() => {
    localStorage.clear();
    seedInjectionMed();
  });

  it("defaults to Abdomen when injectionSiteHistory is an empty array", () => {
    seedUser([]);
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));

    expect(isSiteActive("log-site-abdomen")).toBe(true);
    expect(isSiteActive("log-site-thigh")).toBe(false);
  });

  it("defaults to Abdomen when the user object has no injectionSiteHistory key", () => {
    seedUser(undefined); // no injectionSiteHistory property
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));

    expect(isSiteActive("log-site-abdomen")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Write-back: site is appended to injectionSiteHistory after confirming
// ---------------------------------------------------------------------------

describe("injection site write-back after dose log", () => {
  beforeEach(() => {
    localStorage.clear();
    seedInjectionMed();
  });

  it("appends the pre-filled site to injectionSiteHistory on first-ever dose log", () => {
    seedUser([]); // no history yet
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    // Abdomen is pre-filled (fallback); submit without changing
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const history = getStoredHistory();
    expect(history).toHaveLength(1);
    expect(history[0].site).toBe("Abdomen");
  });

  it("appends a newly chosen site to an existing history", () => {
    seedUser([
      { site: "Abdomen", date: "Jun 1" },
      { site: "Thigh", date: "Jun 8" },
    ]);
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    // Change from the pre-filled "Thigh" to "Upper Arm"
    fireEvent.click(screen.getByTestId("log-site-upper-arm"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const history = getStoredHistory();
    expect(history).toHaveLength(3);
    expect(history[2].site).toBe("Upper Arm");
    // Previous entries are preserved
    expect(history[0].site).toBe("Abdomen");
    expect(history[1].site).toBe("Thigh");
  });

  it("the written site matches the rotation-suggested site when submitted without changing", () => {
    seedUser([
      { site: "Abdomen", date: "Jun 1" },
      { site: "Buttocks", date: "Jun 8" },
    ]);
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    // Last used = Buttocks (idx 3) → rotation pre-fills Abdomen (idx 0); submit without changing
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const history = getStoredHistory();
    // New entry appended; it should match the rotation-suggested (pre-filled) site
    expect(history[history.length - 1].site).toBe("Abdomen");
  });
});
