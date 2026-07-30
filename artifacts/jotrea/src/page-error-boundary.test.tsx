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
