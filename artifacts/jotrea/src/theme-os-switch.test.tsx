/**
 * Theme OS-switch tests
 *
 * Verifies that ThemeProvider correctly responds to OS colour-scheme changes
 * while the app is running:
 *
 * 1. Switching the OS to dark mode adds the "dark" class to <html>.
 * 2. Switching the OS back to light mode removes the "dark" class.
 * 3. An explicit user preference ("light" or "dark") is not overridden by an
 *    OS change.
 * 4. The MediaQueryList change listener is removed when ThemeProvider unmounts
 *    (no stale handler / memory leak).
 */

import { render, act, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { ThemeProvider } from "@/components/ThemeProvider";

// ---------------------------------------------------------------------------
// Stateful matchMedia mock
// ---------------------------------------------------------------------------

/**
 * A minimal but realistic window.matchMedia stub.
 *
 * It stores "change" listeners exactly as the browser would, and exposes
 * `fireChange(matches)` so tests can simulate OS colour-scheme toggles.
 * `removeEventListener` is a real implementation (not just vi.fn()) so we can
 * verify that cleanup actually removes the handler.
 */

let _prefersDark = false;

// All active "change" listeners registered by any component in the current test.
const _changeListeners: Set<(e: Partial<MediaQueryListEvent>) => void> = new Set();

// Spy wrappers so we can assert call counts without losing the real implementation.
const addSpy = vi.fn((type: string, fn: (e: Partial<MediaQueryListEvent>) => void) => {
  if (type === "change") _changeListeners.add(fn);
});

const removeSpy = vi.fn((type: string, fn: (e: Partial<MediaQueryListEvent>) => void) => {
  if (type === "change") _changeListeners.delete(fn);
});

function installMatchMediaMock(prefersDark = false): void {
  _prefersDark = prefersDark;
  _changeListeners.clear();
  addSpy.mockClear();
  removeSpy.mockClear();

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return query === "(prefers-color-scheme: dark)" ? _prefersDark : false;
      },
      media: query,
      onchange: null,
      addEventListener: addSpy,
      removeEventListener: removeSpy,
      dispatchEvent: vi.fn(),
    }),
  });
}

/** Simulate the OS toggling its colour scheme. */
function fireOsChange(prefersDark: boolean): void {
  _prefersDark = prefersDark;
  _changeListeners.forEach((listener) =>
    listener({ matches: prefersDark } as MediaQueryListEvent),
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  installMatchMediaMock(false); // start in light mode by default
});

afterEach(() => {
  cleanup(); // unmount any still-mounted trees
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// OS switches to dark mode while app is open
// ---------------------------------------------------------------------------

describe("OS switches to dark mode while app is running", () => {
  it("adds the dark class when the OS changes to dark and theme is 'system'", () => {
    // No stored preference → theme defaults to "system".
    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => {
      fireOsChange(true);
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes the dark class when the OS switches back to light and theme is 'system'", () => {
    // Start in dark OS mode.
    installMatchMediaMock(true);
    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      fireOsChange(false);
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggles the dark class correctly across multiple OS switches", () => {
    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    act(() => { fireOsChange(true); });
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => { fireOsChange(false); });
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => { fireOsChange(true); });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Explicit user preference overrides OS changes
// ---------------------------------------------------------------------------

describe("explicit user preference is not overridden by OS change", () => {
  it("keeps dark class when user chose 'dark' and OS switches to light", () => {
    localStorage.setItem("jotrea_theme", "dark");

    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    // Explicit preference: dark class should be present regardless of OS.
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => { fireOsChange(false); });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("keeps class off when user chose 'light' and OS switches to dark", () => {
    localStorage.setItem("jotrea_theme", "light");

    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => { fireOsChange(true); });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Listener is cleaned up on unmount
// ---------------------------------------------------------------------------

describe("listener cleanup on unmount", () => {
  it("registers exactly one 'change' listener on mount", () => {
    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    const changeCalls = addSpy.mock.calls.filter(([type]) => type === "change");
    expect(changeCalls).toHaveLength(1);
  });

  it("removes the listener when ThemeProvider unmounts", () => {
    const { unmount } = render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    // Listener must be registered before unmount.
    expect(_changeListeners.size).toBe(1);

    unmount();

    // After unmount the listener set must be empty.
    expect(_changeListeners.size).toBe(0);

    // removeSpy must have been called with "change".
    const removeCalls = removeSpy.mock.calls.filter(([type]) => type === "change");
    expect(removeCalls).toHaveLength(1);
  });

  it("does not update the dark class after unmount", () => {
    const { unmount } = render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    unmount();

    // OS switches to dark after unmount — the class must NOT change.
    act(() => { fireOsChange(true); });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
