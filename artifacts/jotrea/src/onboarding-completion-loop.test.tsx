/**
 * Onboarding completion-loop regression tests
 *
 * Apple rejected the app because tapping the final onboarding button sent
 * users back to the first onboarding screen: navigation to "/" happened
 * while the medication record wasn't persisted, and the root route's
 * `!medication → /onboarding` redirect looped back.
 *
 * These tests lock in the fix (idempotent handleComplete,
 * verifyMedicationSaved(), finishOnboarding() gate, finishingRef tap lock):
 *  1. Happy path — final button persists the medication and lands on the
 *     Dashboard route, never back on Onboarding.
 *  2. A failed first localStorage write triggers the silent retry and still
 *     navigates (no alert, no loop).
 *  3. A persistently failing write shows the alert and does NOT navigate,
 *     and the button stays usable for a later successful attempt.
 *  4. Rapid double-taps of the final buttons never double-fire analytics,
 *     weight seeding, or navigation.
 */

import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { Router, Switch, Route, Redirect } from "wouter";
import { memoryLocation } from "wouter/memory-location";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any import that would trigger them
// ---------------------------------------------------------------------------

vi.mock("framer-motion", () => {
  // Generic passthrough for any motion.<tag>: strips motion-only props.
  const stripMotionProps = (props: Record<string, unknown>) => {
    const {
      whileTap: _wt, initial: _i, animate: _a, exit: _e, variants: _v,
      transition: _t, custom: _c, layout: _l,
      ...rest
    } = props;
    return rest;
  };
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Comp = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
          React.createElement(tag, stripMotionProps(props), children);
        Comp.displayName = `motion.${tag}`;
        return Comp;
      },
    },
  );
  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  };
});

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  initGA: vi.fn(),
  pageView: vi.fn(),
}));

vi.mock("@/utils/notifications", () => ({
  isNotificationSupported: () => true,
  requestNotificationPermission: vi.fn().mockResolvedValue("denied"),
  scheduleAllNotifications: vi.fn().mockResolvedValue(undefined),
  registerNotificationSW: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import subject AFTER mocks are registered
// ---------------------------------------------------------------------------

import Onboarding from "@/pages/Onboarding";
import { useMedication } from "@/hooks/useMedication";
import { trackEvent } from "@/lib/analytics";
import { requestNotificationPermission } from "@/utils/notifications";

// ---------------------------------------------------------------------------
// Test harness — replicates the App.tsx root redirect gate exactly:
//   <Route path="/"> {!medication ? <Redirect to="/onboarding"/> : <Dashboard/>}
// ---------------------------------------------------------------------------

function RootGate() {
  const { medication } = useMedication();
  return (
    <Switch>
      <Route path="/onboarding">
        <Onboarding />
      </Route>
      <Route path="/">
        {!medication ? <Redirect to="/onboarding" /> : <div data-testid="dashboard-page" />}
      </Route>
    </Switch>
  );
}

function renderApp() {
  const memory = memoryLocation({ path: "/onboarding", record: true });
  render(
    <Router hook={memory.hook}>
      <RootGate />
    </Router>,
  );
  return memory;
}

// ---------------------------------------------------------------------------
// Flow driver — walks the real UI from Welcome to the final (step 14) screen
// ---------------------------------------------------------------------------

function advanceToFinalScreen() {
  // Step 0 → 1
  fireEvent.click(screen.getByText("Start Your Journey"));
  // Step 1: gender
  fireEvent.click(screen.getByText("Female"));
  fireEvent.click(screen.getByText("Continue"));
  // Step 2: birthday
  fireEvent.click(screen.getByText("Continue"));
  // Step 3: measurements (Continue also seeds startWeight)
  fireEvent.click(screen.getByText("Continue"));
  // Step 4: start weight & date
  fireEvent.click(screen.getByText("Continue"));
  // Step 5: goal weight ruler
  fireEvent.click(screen.getByText("Continue"));
  // Step 6: pace
  fireEvent.click(screen.getByText("Continue"));
  // Step 7: activity
  fireEvent.click(screen.getByText("Active"));
  fireEvent.click(screen.getByText("Continue"));
  // Step 8: motivation
  fireEvent.click(screen.getByText("Improve my health"));
  fireEvent.click(screen.getByText(/Continue \(1 selected\)/));
  // Step 10: medication list
  fireEvent.click(screen.getByText("Ozempic"));
  // Step 11: dose
  fireEvent.click(screen.getByText("0.5 mg"));
  fireEvent.click(screen.getByText("Craft My Plan →"));
  // Step 12: loading — the 3.1s timer calls handleComplete() then shows step 13
  act(() => {
    vi.advanceTimersByTime(3200);
  });
  // Step 13 → 14
  fireEvent.click(screen.getByText("Let's Get Started →"));
  // Final screen must be visible
  expect(screen.getByText("Maybe later")).toBeInTheDocument();
}

function readSavedMedication() {
  const raw = localStorage.getItem("jotrea_medication");
  return raw ? JSON.parse(raw) : null;
}

function currentPath(memory: { history: string[] }) {
  return memory.history[memory.history.length - 1];
}

// ---------------------------------------------------------------------------
// Controllable in-memory localStorage
//
// jsdom's Storage is a Proxy — spying on Storage.prototype.setItem recurses
// infinitely. Instead we swap in a plain in-memory implementation whose
// writes to "jotrea_medication" can be made to fail on demand, simulating
// iOS storage pressure / quota errors at the worst possible moment.
// ---------------------------------------------------------------------------

type FailMode = null | "once" | "always";
let failMedicationWrites: FailMode = null;

function makeMemoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      if (key === "jotrea_medication" && failMedicationWrites) {
        if (failMedicationWrites === "once") failMedicationWrites = null;
        throw new DOMException("QuotaExceededError");
      }
      data.set(key, String(value));
    },
    removeItem: (key: string) => void data.delete(key),
    clear: () => void data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() {
      return data.size;
    },
  };
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let alertSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  failMedicationWrites = null;
  vi.stubGlobal("localStorage", makeMemoryStorage());
  vi.clearAllMocks();
  vi.useFakeTimers();
  alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  alertSpy.mockRestore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1. Happy path — persist + navigate to Dashboard, never back to Onboarding
// ---------------------------------------------------------------------------

describe("Onboarding completion – happy path", () => {
  it("'Maybe later' persists a valid medication and lands on the Dashboard route", () => {
    const memory = renderApp();
    advanceToFinalScreen();

    fireEvent.click(screen.getByText("Maybe later"));

    // Medication is persisted and structurally valid
    const saved = readSavedMedication();
    expect(saved).not.toBeNull();
    expect(saved.id).toBe("semaglutide-ozempic");
    expect(saved.dose).toBe(0.5);
    expect(saved.active).toBe(true);

    // Landed on "/" and the root gate rendered Dashboard, NOT the redirect
    expect(currentPath(memory)).toBe("/");
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(screen.queryByText("Start Your Journey")).not.toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("'Allow Notifications' persists the medication and lands on the Dashboard route", async () => {
    const memory = renderApp();
    advanceToFinalScreen();

    await act(async () => {
      fireEvent.click(screen.getByText("Allow Notifications"));
    });

    expect(readSavedMedication()).not.toBeNull();
    expect(currentPath(memory)).toBe("/");
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(screen.queryByText("Start Your Journey")).not.toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Failed first write — silent retry succeeds, no loop, no alert
// ---------------------------------------------------------------------------

describe("Onboarding completion – failed first localStorage write", () => {
  it("retries the medication write once and still navigates to Dashboard", () => {
    const memory = renderApp();

    // The FIRST jotrea_medication write fails (simulates iOS storage
    // pressure / quota error at the worst possible moment).
    failMedicationWrites = "once";

    advanceToFinalScreen();
    // The step-12 handleComplete write failed silently; verify that:
    expect(readSavedMedication()).toBeNull();

    fireEvent.click(screen.getByText("Maybe later"));

    // finishOnboarding detected the missing record, retried the write, and
    // navigated — no alert, no loop back to onboarding.
    expect(readSavedMedication()).not.toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(currentPath(memory)).toBe("/");
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(screen.queryByText("Start Your Journey")).not.toBeInTheDocument();
  });

  it("alerts and stays on onboarding when the write keeps failing, then recovers on a later tap", () => {
    const memory = renderApp();

    // Writes fail from before step 12's handleComplete onward.
    failMedicationWrites = "always";
    advanceToFinalScreen();

    fireEvent.click(screen.getByText("Maybe later"));

    // Alert shown, NO navigation, NO silent loop back to the first screen —
    // the user stays on the final screen where they can tap again.
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(currentPath(memory)).toBe("/onboarding");
    expect(screen.queryByTestId("dashboard-page")).not.toBeInTheDocument();
    expect(screen.getByText("Maybe later")).toBeInTheDocument();
    expect(readSavedMedication()).toBeNull();

    // Storage recovers → the same button must work (finishingRef was reset).
    failMedicationWrites = null;
    fireEvent.click(screen.getByText("Maybe later"));

    expect(readSavedMedication()).not.toBeNull();
    expect(currentPath(memory)).toBe("/");
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Rapid double-taps — no double analytics, seeding, or navigation
// ---------------------------------------------------------------------------

describe("Onboarding completion – rapid double-taps", () => {
  it("double-tapping 'Maybe later' fires analytics and navigation exactly once", () => {
    const memory = renderApp();
    advanceToFinalScreen();

    const btn = screen.getByText("Maybe later");
    fireEvent.click(btn);
    fireEvent.click(btn);

    // onboarding_complete fired exactly once across timer + double tap
    const completeCalls = (trackEvent as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([name]) => name === "onboarding_complete",
    );
    expect(completeCalls).toHaveLength(1);

    // Starting weight seeded exactly once
    const weights = JSON.parse(localStorage.getItem("jotrea_weights") ?? "[]");
    expect(weights).toHaveLength(1);

    // Navigated to "/" exactly once
    const navsToRoot = memory.history.filter((p) => p === "/");
    expect(navsToRoot).toHaveLength(1);
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("double-tapping 'Allow Notifications' requests permission and navigates exactly once", async () => {
    const memory = renderApp();
    advanceToFinalScreen();

    const btn = screen.getByText("Allow Notifications");
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn); // second tap lands while the first is in flight
    });

    expect(requestNotificationPermission).toHaveBeenCalledTimes(1);

    const completeCalls = (trackEvent as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([name]) => name === "onboarding_complete",
    );
    expect(completeCalls).toHaveLength(1);

    const navsToRoot = memory.history.filter((p) => p === "/");
    expect(navsToRoot).toHaveLength(1);
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });
});
