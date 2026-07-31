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
// Helpers used by custom-formulation tests below
// ---------------------------------------------------------------------------

const DOSES_KEY = "jotrea_doses";

/** Seeds a custom-injection medication (medication.id === "custom", injectionSite set). */
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
      injectionSite: "Abdomen", // presence signals injection formulation
    }),
  );
}

/** Seeds a custom-oral medication (medication.id === "custom", no injectionSite). */
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

/** Returns the stored dose array from localStorage. */
function getStoredDoses(): Array<{ site?: string; [key: string]: unknown }> {
  const raw = localStorage.getItem(DOSES_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Array<{ site?: string; [key: string]: unknown }>;
}

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

// ---------------------------------------------------------------------------
// 4. Custom injection medication — Dashboard site picker and history write-back
// ---------------------------------------------------------------------------

describe("custom injection medication — Dashboard", () => {
  beforeEach(() => {
    localStorage.clear();
    seedCustomInjectionMed();
    seedUser([]);
  });

  it("shows the injection site picker in the log form", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // All four site buttons must be present
    expect(screen.queryByTestId("log-site-abdomen")).not.toBeNull();
    expect(screen.queryByTestId("log-site-thigh")).not.toBeNull();
    expect(screen.queryByTestId("log-site-upper-arm")).not.toBeNull();
    expect(screen.queryByTestId("log-site-buttocks")).not.toBeNull();
  });

  it("appends a site entry to injectionSiteHistory after logging", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    // Abdomen is pre-filled (empty history fallback); submit without changing
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const history = getStoredHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[history.length - 1].site).toBe("Abdomen");
  });

  it("saves a non-oral site to the dose entry", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("log-site-thigh")); // switch to Thigh
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const doses = getStoredDoses();
    expect(doses.length).toBeGreaterThanOrEqual(1);
    expect(doses[doses.length - 1].site).toBe("Thigh");
  });

  it("suggests the next rotation site from history when opening log form", () => {
    // Seed history with Abdomen as last site → next should be Thigh
    seedUser([{ site: "Abdomen", date: "Jul 1" }]);
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // Thigh (index 1) should be active; Abdomen should not
    expect(isSiteActive("log-site-thigh")).toBe(true);
    expect(isSiteActive("log-site-abdomen")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Custom oral medication — Dashboard site picker and history behaviour
// ---------------------------------------------------------------------------

describe("custom oral medication — Dashboard", () => {
  beforeEach(() => {
    localStorage.clear();
    seedCustomOralMed();
    seedUser([]);
  });

  it("hides the injection site picker in the log form", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // No site buttons should appear
    expect(screen.queryByTestId("log-site-abdomen")).toBeNull();
    expect(screen.queryByTestId("log-site-thigh")).toBeNull();
    expect(screen.queryByTestId("log-site-upper-arm")).toBeNull();
    expect(screen.queryByTestId("log-site-buttocks")).toBeNull();
  });

  it("saves 'oral' as the site in the dose entry", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    const doses = getStoredDoses();
    expect(doses.length).toBeGreaterThanOrEqual(1);
    expect(doses[doses.length - 1].site).toBe("oral");
  });

  it("does NOT write a site entry to injectionSiteHistory", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));

    // History should remain empty — no injection sites should be recorded
    const history = getStoredHistory();
    expect(history).toHaveLength(0);
  });
});
