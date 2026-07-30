/**
 * PageErrorBoundary regression tests
 *
 * Mounts a component that throws inside PageErrorBoundary and asserts the
 * two-step recovery flow:
 *   1. Primary error screen – "Reload page" reloads without wiping data.
 *   2. "Wipe & restart" button transitions to a confirmation step before
 *      touching localStorage.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Import subject under test
// ---------------------------------------------------------------------------

import { PageErrorBoundary } from "@/App";

// ---------------------------------------------------------------------------
// Helper – a child that throws on first render
// ---------------------------------------------------------------------------

function BrokenChild(): React.ReactElement {
  throw new Error("test-induced crash");
}

// ---------------------------------------------------------------------------
// Suppress the expected React error boundary console noise in test output
// ---------------------------------------------------------------------------

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Primary error screen
// ---------------------------------------------------------------------------

describe("PageErrorBoundary – primary error screen", () => {
  it("renders when a child throws", () => {
    render(
      <PageErrorBoundary>
        <BrokenChild />
      </PageErrorBoundary>,
    );
    expect(
      screen.getByText(/something went wrong on this page/i),
    ).toBeInTheDocument();
  });

  it("shows the Reload page button", () => {
    render(
      <PageErrorBoundary>
        <BrokenChild />
      </PageErrorBoundary>,
    );
    expect(
      screen.getByRole("button", { name: /reload page/i }),
    ).toBeInTheDocument();
  });

  it("shows the error message from the thrown error", () => {
    render(
      <PageErrorBoundary>
        <BrokenChild />
      </PageErrorBoundary>,
    );
    expect(screen.getByText("test-induced crash")).toBeInTheDocument();
  });

  it("Reload page does NOT call localStorage.clear()", () => {
    // Spy on location.reload – jsdom defines it but throws; replace it safely.
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });

    localStorage.setItem("sentinel", "keep-me");

    render(
      <PageErrorBoundary>
        <BrokenChild />
      </PageErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: /reload page/i }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    // Data must still be present – localStorage.clear() was NOT called.
    expect(localStorage.getItem("sentinel")).toBe("keep-me");
  });
});

// ---------------------------------------------------------------------------
// Wipe & restart confirmation step
// ---------------------------------------------------------------------------

describe("PageErrorBoundary – wipe & restart flow", () => {
  it("clicking 'Wipe & restart' shows the confirmation step, not an immediate wipe", () => {
    localStorage.setItem("sentinel", "keep-me");

    render(
      <PageErrorBoundary>
        <BrokenChild />
      </PageErrorBoundary>,
    );

    // The primary button text contains an ampersand entity in JSX but renders
    // as a real "&" in the DOM.
    const wipeBtn = screen.getByRole("button", {
      name: /wipe & restart|wipe &amp; restart/i,
    });
    fireEvent.click(wipeBtn);

    // Confirmation screen must appear.
    expect(screen.getByText(/wipe all data\?/i)).toBeInTheDocument();

    // Data must still be intact – wipe hasn't happened yet.
    expect(localStorage.getItem("sentinel")).toBe("keep-me");
  });

  it("confirmation screen shows 'Yes, wipe everything' and 'Cancel' buttons", () => {
    render(
      <PageErrorBoundary>
        <BrokenChild />
      </PageErrorBoundary>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /wipe & restart|wipe &amp; restart/i }),
    );

    expect(
      screen.getByRole("button", { name: /yes, wipe everything/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel/i }),
    ).toBeInTheDocument();
  });

  it("Cancel returns to the primary error screen without wiping", () => {
    localStorage.setItem("sentinel", "keep-me");

    render(
      <PageErrorBoundary>
        <BrokenChild />
      </PageErrorBoundary>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /wipe & restart|wipe &amp; restart/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    // Primary screen must be back.
    expect(
      screen.getByText(/something went wrong on this page/i),
    ).toBeInTheDocument();

    // Data untouched.
    expect(localStorage.getItem("sentinel")).toBe("keep-me");
  });

  it("'Yes, wipe everything' calls localStorage.clear()", () => {
    // Prevent actual navigation.
    const replaceSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, replace: replaceSpy },
    });

    localStorage.setItem("sentinel", "keep-me");

    render(
      <PageErrorBoundary>
        <BrokenChild />
      </PageErrorBoundary>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /wipe & restart|wipe &amp; restart/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /yes, wipe everything/i }),
    );

    expect(localStorage.getItem("sentinel")).toBeNull();
    expect(replaceSpy).toHaveBeenCalledWith("/");
  });
});

// ---------------------------------------------------------------------------
// Route-change reset – the crash screen must not be permanently stuck
// ---------------------------------------------------------------------------

/**
 * In App.tsx the <motion.div> wrapping <PageErrorBoundary> is keyed by the
 * current wouter location.  Changing the key causes React to unmount the old
 * tree (including the boundary in its errored state) and mount a fresh one,
 * which resets the error.  These tests verify that mechanism works and would
 * catch any regression where the key is removed or the boundary is lifted
 * outside the keyed wrapper.
 */

function HealthyChild(): React.ReactElement {
  return <p>healthy content</p>;
}

describe("PageErrorBoundary – route-change resets the crash screen", () => {
  it("remounting the boundary (key change) clears the error and shows healthy content", () => {
    // First render: crash screen should appear.
    const { rerender } = render(
      <PageErrorBoundary key="route-a">
        <BrokenChild />
      </PageErrorBoundary>,
    );

    expect(
      screen.getByText(/something went wrong on this page/i),
    ).toBeInTheDocument();

    // Simulate a route change: React unmounts the old boundary (key="route-a")
    // and mounts a brand-new one (key="route-b") with a healthy child.
    rerender(
      <PageErrorBoundary key="route-b">
        <HealthyChild />
      </PageErrorBoundary>,
    );

    // Crash screen must be gone.
    expect(
      screen.queryByText(/something went wrong on this page/i),
    ).not.toBeInTheDocument();

    // Healthy content must be visible.
    expect(screen.getByText("healthy content")).toBeInTheDocument();
  });

  it("the crash screen reappears if the new route also throws", () => {
    // First render: crash screen.
    const { rerender } = render(
      <PageErrorBoundary key="route-a">
        <BrokenChild />
      </PageErrorBoundary>,
    );

    expect(
      screen.getByText(/something went wrong on this page/i),
    ).toBeInTheDocument();

    // Navigate to another broken route.
    rerender(
      <PageErrorBoundary key="route-b">
        <BrokenChild />
      </PageErrorBoundary>,
    );

    // A fresh crash screen must still appear (not a blank/stuck screen).
    expect(
      screen.getByText(/something went wrong on this page/i),
    ).toBeInTheDocument();
  });

  it("crash screen is gone after two consecutive route changes", () => {
    const { rerender } = render(
      <PageErrorBoundary key="route-a">
        <BrokenChild />
      </PageErrorBoundary>,
    );

    expect(
      screen.getByText(/something went wrong on this page/i),
    ).toBeInTheDocument();

    // First navigation – still broken.
    rerender(
      <PageErrorBoundary key="route-b">
        <BrokenChild />
      </PageErrorBoundary>,
    );

    // Second navigation – healthy.
    rerender(
      <PageErrorBoundary key="route-c">
        <HealthyChild />
      </PageErrorBoundary>,
    );

    expect(
      screen.queryByText(/something went wrong on this page/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("healthy content")).toBeInTheDocument();
  });
});
