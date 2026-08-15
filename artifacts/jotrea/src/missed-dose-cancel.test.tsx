/**
 * Missed-dose notification cancellation — integration tests
 *
 * Verifies that Dashboard.handleLogDose calls cancelNotificationTag with
 * `jotrea-missed-dose-${logDate}` every time a dose is logged, covering:
 *
 *   (a) Dose logged before 9 PM — the missed-dose notification is still
 *       pending in the SW; cancelling it prevents it from firing later.
 *
 *   (b) Dose logged after 9 PM — the missed-dose notification may have
 *       already been shown; cancelling it dismisses any visible notification.
 *
 * Uses vi.setSystemTime to control "now" so the logDate that Dashboard
 * initialises to matches the assertion exactly.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

// ─── Module mocks (must be declared before the imports they shadow) ──────────

vi.mock("@/utils/notifications", () => ({
  isNotificationSupported: () => true,
  cancelNotificationTag: vi.fn().mockResolvedValue(undefined),
  rescheduleAllNotifications: vi.fn().mockResolvedValue(undefined),
  registerNotificationSW: vi.fn().mockResolvedValue(null),
  requestNotificationPermission: vi.fn().mockResolvedValue("denied"),
  scheduleAllNotifications: vi.fn().mockResolvedValue(undefined),
  cancelAllNotifications: vi.fn().mockResolvedValue(undefined),
  getNextScheduledTime: vi.fn().mockReturnValue(null),
}));

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

// ─── Imports after mocks ──────────────────────────────────────────────────────

import Dashboard from "@/pages/Dashboard";
import { cancelNotificationTag } from "@/utils/notifications";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MEDICATION_KEY = "jotrea_medication";
const USER_KEY = "jotrea_user";

function seedMed() {
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

function seedUser() {
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      name: "Test",
      units: "lbs",
      subscription: "free",
      injectionSiteHistory: [],
    }),
  );
}

/** Renders Dashboard and performs the minimum interaction to trigger handleLogDose. */
function logDoseViaUI() {
  render(<Dashboard />);
  fireEvent.click(screen.getByTestId("log-dose-btn")); // open sheet
  fireEvent.click(screen.getByTestId("submit-log-dose")); // confirm
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("handleLogDose — missed-dose notification cancellation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    seedMed();
    seedUser();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("scenario (a): dose logged before 9 PM", () => {
    it("cancels the missed-dose notification for today when the dose is logged at 14:30", () => {
      // Fix clock to 14:30 on 2026-07-30 — before the 21:00 missed-dose window
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-30T14:30:00"));

      logDoseViaUI();

      expect(cancelNotificationTag).toHaveBeenCalledWith(
        "jotrea-missed-dose-2026-07-30",
      );
    });

    it("calls cancelNotificationTag exactly once per dose log (before 9 PM)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-30T08:00:00"));

      logDoseViaUI();

      expect(cancelNotificationTag).toHaveBeenCalledTimes(1);
    });
  });

  describe("scenario (b): dose logged after 9 PM", () => {
    it("cancels the missed-dose notification for today when the dose is logged at 21:45", () => {
      // Fix clock to 21:45 on 2026-07-30 — after the missed-dose notification fires
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-30T21:45:00"));

      logDoseViaUI();

      expect(cancelNotificationTag).toHaveBeenCalledWith(
        "jotrea-missed-dose-2026-07-30",
      );
    });

    it("calls cancelNotificationTag exactly once per dose log (after 9 PM)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-30T23:59:00"));

      logDoseViaUI();

      expect(cancelNotificationTag).toHaveBeenCalledTimes(1);
    });
  });

  it("uses the logDate from the form, not the current wall-clock date, when logging a backdated dose", () => {
    vi.useFakeTimers();
    // "Now" is 2026-07-30, but the user changes the date field to a past date
    vi.setSystemTime(new Date("2026-07-30T10:00:00"));

    render(<Dashboard />);
    fireEvent.click(screen.getByTestId("log-dose-btn"));

    // Change the date to a past dose day
    fireEvent.change(screen.getByTestId("log-date"), {
      target: { value: "2026-07-23" },
    });

    fireEvent.click(screen.getByTestId("submit-log-dose"));

    expect(cancelNotificationTag).toHaveBeenCalledWith(
      "jotrea-missed-dose-2026-07-23",
    );
  });

  it("sends the CANCEL_TAG message with the correct tag format in both time windows", () => {
    // Before 9 PM
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T15:00:00"));
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId("log-dose-btn"));
    fireEvent.click(screen.getByTestId("submit-log-dose"));
    expect(cancelNotificationTag).toHaveBeenLastCalledWith(
      "jotrea-missed-dose-2026-07-30",
    );
  });
});
