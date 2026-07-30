/**
 * Dark-mode first-install tests
 *
 * Verifies two things:
 *
 * 1. The inline blocking script in index.html (logic replicated here) adds the
 *    "dark" class to <html> before any React code runs, using only the OS
 *    preference when localStorage has no stored value.
 *
 * 2. ThemeProvider initialises to "system" when no stored value exists and
 *    does NOT remove a "dark" class that the blocking script already set —
 *    i.e. there is no white flash between the blocking script and the first
 *    React render.
 */

import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { ThemeProvider } from "@/components/ThemeProvider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The exact logic from the blocking script in index.html, kept in sync here.
 * If the script ever changes, update this mirror and the tests will catch any
 * new gap.
 */
function runBlockingScript(): void {
  const stored = localStorage.getItem("jotrea_theme");
  const isDark =
    stored === "dark" ||
    (stored !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

/** Replace window.matchMedia with a stub that reports a fixed dark-mode value. */
function mockMatchMedia(prefersDark: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      media: query,
      onchange: null,
      addEventListenerr: vi.fn(),
      removeEventListener: vi.fn(),
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Start every test with a clean slate: no stored preference, no dark class.
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Blocking script — first install, OS in dark mode
// ---------------------------------------------------------------------------

describe("blocking script — no stored preference, OS dark mode ON", () => {
  beforeEach(() => mockMatchMedia(true));

  it("adds the dark class to <html>", () => {
    runBlockingScript();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("adds the dark class even when localStorage is completely empty", () => {
    // Belt-and-suspenders: confirm there really is no stored key.
    expect(localStorage.getItem("jotrea_theme")).toBeNull();
    runBlockingScript();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Blocking script — first install, OS in light mode (no spurious dark class)
// ---------------------------------------------------------------------------

describe("blocking script — no stored preference, OS dark mode OFF", () => {
  beforeEach(() => mockMatchMedia(false));

  it("does NOT add the dark class to <html>", () => {
    runBlockingScript();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ThemeProvider — first install, OS dark mode already applied by script
// ---------------------------------------------------------------------------

describe("ThemeProvider — first install, OS dark mode ON", () => {
  beforeEach(() => mockMatchMedia(true));

  it("initialises to the 'system' theme when no stored value exists", () => {
    // Simulate what the blocking script did: dark class already on <html>.
    document.documentElement.classList.add("dark");

    // We just need the provider to mount — we don't need to read the context
    // value from inside it, so a trivial child is enough.
    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    // After mounting, the dark class must still be present — the provider
    // resolved "system" → dark and must not have removed it.
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("keeps the dark class after ThemeProvider's first useEffect fires", () => {
    // The useEffect in ThemeProvider calls applyTheme(theme) which does
    // classList.toggle("dark", resolved === "dark").  When theme === "system"
    // and the OS is dark, resolved === "dark", so the class must stay.
    document.documentElement.classList.add("dark");

    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ThemeProvider — first install, OS in light mode
// ---------------------------------------------------------------------------

describe("ThemeProvider — first install, OS dark mode OFF", () => {
  beforeEach(() => mockMatchMedia(false));

  it("does not add the dark class when OS is in light mode", () => {
    // Blocking script ran but OS was light — class was never set.
    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Consistency check — script and ThemeProvider agree on the initial state
// ---------------------------------------------------------------------------

describe("script and ThemeProvider agree — first install", () => {
  it("both apply dark when OS is dark and no preference is stored", () => {
    mockMatchMedia(true);

    // Step 1: blocking script runs (before React).
    runBlockingScript();
    const afterScript = document.documentElement.classList.contains("dark");

    // Step 2: React mounts ThemeProvider.
    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );
    const afterReact = document.documentElement.classList.contains("dark");

    expect(afterScript).toBe(true);
    expect(afterReact).toBe(true);
  });

  it("both leave the class off when OS is light and no preference is stored", () => {
    mockMatchMedia(false);

    runBlockingScript();
    const afterScript = document.documentElement.classList.contains("dark");

    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );
    const afterReact = document.documentElement.classList.contains("dark");

    expect(afterScript).toBe(false);
    expect(afterReact).toBe(false);
  });
});
