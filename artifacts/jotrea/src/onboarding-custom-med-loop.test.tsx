/**
 * Onboarding completion-loop regression — custom ("Other") medication path
 *
 * The standard-catalog tests in onboarding-completion-loop.test.tsx cover
 * Ozempic (selectedMed path). This file covers the "Other medication" branch
 * where buildMedication() constructs the record differently:
 *   - id is always "custom" (not a catalog id)
 *   - dose comes from parseFloat(customDoseAmt), which is 0 when the field is
 *     blank — a regression there would produce an invalid record that satisfies
 *     neither verifyMedicationSaved() nor the root-route medication guard,
 *     reintroducing the Apple-rejected loop for custom-med users.
 *
 * Tests:
 *  1. Happy path — custom brand + dose → valid record (id "custom", numeric
 *     dose > 0) persisted, app lands on Dashboard.
 *  2. Failed first write → silent retry + Dashboard (no alert, no loop).
 *  3. Persistently failing write → alert, stays on final screen, recovers on
 *     a later tap.
 *  4. Rapid double-taps → analytics and navigation fire exactly once.
 */

import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { Router, Switch, Route, Redirect } from "wouter";
import { memoryLocation } from "wouter/memory-location";

// ---------------------------------------------------------------------------
// Module mocks — declared before any import that triggers them
// ---------------------------------------------------------------------------

vi.mock("framer-motion", () => {
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
// Test harness — mirrors App.tsx root redirect gate exactly
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
// Flow driver — walks the real UI through the custom ("Other") medication path
//
// Steps 0-8 are identical to the catalog path. From step 10 onward the user
// selects "Other medication", fills in the custom form, then continues to the
// dose/frequency screen and the loading screen before reaching the final
// notifications screen.
// ---------------------------------------------------------------------------

const CUSTOM_BRAND = "MyGLP";
const CUSTOM_DOSE  = "2.5";

function advanceToFinalScreenCustom() {
  // Step 0 → 1
  fireEvent.click(screen.getByText("Start Your Journey"));
  // Step 1: gender
  fireEvent.click(screen.getByText("Female"));
  fireEvent.click(screen.getByText("Continue"));
  // Step 2: birthday
  fireEvent.click(screen.getByText("Continue"));
  // Step 3: measurements (seeds startWeight on the way out)
  fireEvent.click(screen.getByText("Continue"));
  // Step 4: start weight & GLP-1 start date
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

  // Step 10: medication list — choose "Other medication" to open the custom form
  fireEvent.click(screen.getByText("Other medication"));

  // Still step 10 — custom form is now visible. Fill in the required brand field.
  const brandInput = screen.getByPlaceholderText(/e\.g\. Ozempic, Wegovy, Mounjaro/i);
  fireEvent.change(brandInput, { target: { value: CUSTOM_BRAND } });

  // "Continue →" is the custom-form advance button (distinct from "Continue")
  fireEvent.click(screen.getByText("Continue →"));

  // Step 11: custom dose + frequency screen.
  // Fill in dose amount (required to enable "Craft My Plan →").
  const doseInput = screen.getByPlaceholderText(/e\.g\. 2\.5/i);
  fireEvent.change(doseInput, { target: { value: CUSTOM_DOSE } });

  // "Weekly" is selected by default — no extra click needed.
  // Advance to loading.
  fireEvent.click(screen.getByText("Craft My Plan →"));

  // Step 12: loading — 3.1 s timer calls handleComplete() then shows step 13.
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
// (same approach as onboarding-completion-loop.test.tsx)
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
// Shared setup / teardown
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
// 1. Happy path
// ---------------------------------------------------------------------------

describe("Onboarding completion (custom med) – happy path", () => {
  it("'Maybe later' persists a structurally valid custom record and lands on Dashboard", () => {
    const memory = renderApp();
    advanceToFinalScreenCustom();

    fireEvent.click(screen.getByText("Maybe later"));

    // Record is persisted and structurally sound
    const saved = readSavedMedication();
    expect(saved).not.toBeNull();
    // Custom branch always sets id to "custom"
    expect(saved.id).toBe("custom");
    // dose must be a real number derived from parseFloat(customDoseAmt)
    expect(typeof saved.dose).toBe("number");
    expect(isNaN(saved.dose)).toBe(false);
    expect(saved.dose).toBeGreaterThan(0);
    expect(saved.dose).toBe(parseFloat(CUSTOM_DOSE));
    // active flag must be set so the root-route guard sees a valid medication
    expect(saved.active).toBe(true);

    // Landed on "/" and the root gate rendered Dashboard, not the redirect
    expect(currentPath(memory)).toBe("/");
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(screen.queryByText("Start Your Journey")).not.toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("'Allow Notifications' persists the custom record and lands on Dashboard", async () => {
    const memory = renderApp();
    advanceToFinalScreenCustom();

    await act(async () => {
      fireEvent.click(screen.getByText("Allow Notifications"));
    });

    const saved = readSavedMedication();
    expect(saved).not.toBeNull();
    expect(saved.id).toBe("custom");
    expect(typeof saved.dose).toBe("number");
    expect(saved.dose).toBeGreaterThan(0);
    expect(currentPath(memory)).toBe("/");
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(screen.queryByText("Start Your Journey")).not.toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Failed first localStorage write — silent retry, no loop, no alert
// ---------------------------------------------------------------------------

describe("Onboarding completion (custom med) – failed first write", () => {
  it("retries the medication write once and still navigates to Dashboard", () => {
    const memory = renderApp();

    // The FIRST jotrea_medication write (step-12 handleComplete) fails.
    failMedicationWrites = "once";

    advanceToFinalScreenCustom();
    // handleComplete's write failed silently
    expect(readSavedMedication()).toBeNull();

    fireEvent.click(screen.getByText("Maybe later"));

    // finishOnboarding detected the missing record, retried, and navigated
    const saved = readSavedMedication();
    expect(saved).not.toBeNull();
    expect(saved.id).toBe("custom");
    expect(saved.dose).toBe(parseFloat(CUSTOM_DOSE));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(currentPath(memory)).toBe("/");
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(screen.queryByText("Start Your Journey")).not.toBeInTheDocument();
  });

  it("alerts and stays on the final screen when writes keep failing, recovers on a later tap", () => {
    const memory = renderApp();

    failMedicationWrites = "always";
    advanceToFinalScreenCustom();

    fireEvent.click(screen.getByText("Maybe later"));

    // Alert shown, no navigation, user stays on the final screen
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(currentPath(memory)).toBe("/onboarding");
    expect(screen.queryByTestId("dashboard-page")).not.toBeInTheDocument();
    expect(screen.getByText("Maybe later")).toBeInTheDocument();
    expect(readSavedMedication()).toBeNull();

    // Storage recovers → same button works (finishingRef was reset)
    failMedicationWrites = null;
    fireEvent.click(screen.getByText("Maybe later"));

    const saved = readSavedMedication();
    expect(saved).not.toBeNull();
    expect(saved.id).toBe("custom");
    expect(currentPath(memory)).toBe("/");
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Rapid double-taps — no double analytics, seeding, or navigation
// ---------------------------------------------------------------------------

describe("Onboarding completion (custom med) – rapid double-taps", () => {
  it("double-tapping 'Maybe later' fires analytics and navigation exactly once", () => {
    const memory = renderApp();
    advanceToFinalScreenCustom();

    const btn = screen.getByText("Maybe later");
    fireEvent.click(btn);
    fireEvent.click(btn);

    // onboarding_complete fired exactly once
    const completeCalls = (trackEvent as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([name]) => name === "onboarding_complete",
    );
    expect(completeCalls).toHaveLength(1);
    // The event carries the custom brand name
    expect(completeCalls[0][1]).toMatchObject({ medication: CUSTOM_BRAND });

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
    advanceToFinalScreenCustom();

    const btn = screen.getByText("Allow Notifications");
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
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
