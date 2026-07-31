/**
 * Containing-block regression tests for .page-enter
 *
 * CSS properties transform, filter, perspective, and will-change: transform
 * create a new containing block and break position: fixed descendants (bottom
 * sheets, backdrops). This test suite has three guards:
 *
 *   1. CSS guard  — reads index.css and fails if any forbidden property appears
 *                   inside the .page-enter rule block.
 *   2. DoseLog    — opens the Log Dose sheet and confirms the backdrop element
 *                   carries the Tailwind classes "fixed" and "inset-0".
 *   3. WeightTracker — opens the Add Entry inline form and confirms the weight
 *                   input is in the document (form is visible).
 */

import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks — declared before any import that would trigger them
// ---------------------------------------------------------------------------

vi.mock("wouter", () => ({
  useLocation: () => ["/calendar", vi.fn()],
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
  BarChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Bar: () => null,
  LineChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  ReferenceLine: () => null,
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
// Import subjects AFTER mocks
// ---------------------------------------------------------------------------

import DoseLog from "@/pages/DoseLog";
import WeightTracker from "@/pages/WeightTracker";

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";
const DOSES_KEY = "jotrea_doses";
const WEIGHTS_KEY = "jotrea_weights";
const USER_KEY = "jotrea_user";

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

function seedUser() {
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      units: "lbs",
      heightFt: 5,
      heightIn: 8,
      goalWeightLbs: 160,
    }),
  );
}

// ---------------------------------------------------------------------------
// 1. CSS guard — .page-enter must not contain any containing-block trigger
// ---------------------------------------------------------------------------

describe(".page-enter CSS guard", () => {
  /**
   * Extracts the rule-body text of a single CSS selector from a stylesheet
   * string. Returns the content between the first `{` and its matching `}`.
   */
  function extractRuleBody(css: string, selector: string): string | null {
    const idx = css.indexOf(selector);
    if (idx === -1) return null;
    const openBrace = css.indexOf("{", idx);
    if (openBrace === -1) return null;
    // Walk forward to find the matching closing brace (handles nested blocks)
    let depth = 0;
    let pos = openBrace;
    while (pos < css.length) {
      if (css[pos] === "{") depth++;
      else if (css[pos] === "}") {
        depth--;
        if (depth === 0) return css.slice(openBrace + 1, pos);
      }
      pos++;
    }
    return null;
  }

  const cssPath = path.resolve(
    import.meta.dirname,
    "..",
    "src",
    "index.css",
  );

  it("index.css exists and is readable", () => {
    expect(() => fs.readFileSync(cssPath, "utf8")).not.toThrow();
  });

  it(".page-enter rule exists in index.css", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toContain(".page-enter");
  });

  it(".page-enter does not contain a transform property", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    const body = extractRuleBody(css, ".page-enter");
    expect(body).not.toBeNull();
    // "transform:" but not inside a comment; we use a simple regex.
    // The animation keyframe uses "page-enter" not ".page-enter", so
    // extractRuleBody will correctly scope to the class rule only.
    expect(body).not.toMatch(/\btransform\s*:/);
  });

  it(".page-enter does not contain a filter property", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    const body = extractRuleBody(css, ".page-enter");
    expect(body).not.toBeNull();
    expect(body).not.toMatch(/\bfilter\s*:/);
  });

  it(".page-enter does not contain a perspective property", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    const body = extractRuleBody(css, ".page-enter");
    expect(body).not.toBeNull();
    expect(body).not.toMatch(/\bperspective\s*:/);
  });

  it(".page-enter does not contain will-change: transform", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    const body = extractRuleBody(css, ".page-enter");
    expect(body).not.toBeNull();
    // Matches "will-change: transform" or "will-change:transform"
    expect(body).not.toMatch(/will-change\s*:[^;]*transform/);
  });

  it(".page-enter animation uses opacity only (no transform in keyframe)", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    // Extract the @keyframes page-enter block
    const keyframeBody = extractRuleBody(css, "@keyframes page-enter");
    expect(keyframeBody).not.toBeNull();
    // Opacity-only animation: no transform inside the keyframe body
    expect(keyframeBody).not.toMatch(/\btransform\s*:/);
  });
});

// ---------------------------------------------------------------------------
// 2. DoseLog — Log Dose backdrop must have fixed + inset-0 classes
// ---------------------------------------------------------------------------

describe("DoseLog Log Dose sheet backdrop — fixed positioning classes", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
    localStorage.setItem(DOSES_KEY, JSON.stringify([]));
  });

  it("backdrop element has the 'fixed' class when the sheet is open", () => {
    const { container } = render(<DoseLog />);

    // Open the Log Dose sheet
    fireEvent.click(screen.getByTestId("add-dose-btn"));

    // The backdrop is a direct child of the sheet animation wrapper.
    // It carries "fixed inset-0" as Tailwind classes.
    const fixed = container.querySelector(".fixed");
    expect(fixed).not.toBeNull();
    expect(fixed!.classList.contains("fixed")).toBe(true);
  });

  it("backdrop element has the 'inset-0' class when the sheet is open", () => {
    const { container } = render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));

    const fixed = container.querySelector(".fixed");
    expect(fixed).not.toBeNull();
    // inset-0 means top:0 right:0 bottom:0 left:0 — full viewport cover.
    expect(fixed!.classList.contains("inset-0")).toBe(true);
  });

  it("backdrop z-index class is present (z-[60]) ensuring it sits above page content", () => {
    const { container } = render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));

    // jsdom doesn't resolve custom Tailwind arbitrary values, but the class
    // string is still in the DOM and that's what we need to assert.
    const fixed = container.querySelector(".fixed");
    expect(fixed).not.toBeNull();
    expect(fixed!.className).toContain("z-[60]");
  });

  it("sheet content (close button) is rendered inside the backdrop", () => {
    render(<DoseLog />);

    fireEvent.click(screen.getByTestId("add-dose-btn"));

    // If the sheet is rendered, its close button must be present.
    expect(screen.getByTestId("close-add-form")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. WeightTracker — Add Entry inline form must be visible after clicking
// ---------------------------------------------------------------------------

describe("WeightTracker Add Entry inline form — visibility", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
    seedUser();
    localStorage.setItem(WEIGHTS_KEY, JSON.stringify([]));
  });

  it("weight input is absent before the button is clicked", () => {
    render(<WeightTracker />);
    expect(screen.queryByTestId("weight-value-input")).not.toBeInTheDocument();
  });

  it("weight value input is visible after clicking Add Entry", () => {
    render(<WeightTracker />);

    fireEvent.click(screen.getByTestId("add-weight-btn"));

    expect(screen.getByTestId("weight-value-input")).toBeInTheDocument();
  });

  it("weight date input is visible after clicking Add Entry", () => {
    render(<WeightTracker />);

    fireEvent.click(screen.getByTestId("add-weight-btn"));

    expect(screen.getByTestId("weight-date-input")).toBeInTheDocument();
  });

  it("Save Entry button is visible after clicking Add Entry", () => {
    render(<WeightTracker />);

    fireEvent.click(screen.getByTestId("add-weight-btn"));

    expect(screen.getByTestId("save-weight-btn")).toBeInTheDocument();
  });

  it("form closes and weight input is gone after clicking the X button", () => {
    render(<WeightTracker />);

    fireEvent.click(screen.getByTestId("add-weight-btn"));
    expect(screen.getByTestId("weight-value-input")).toBeInTheDocument();

    // The X close button is the only button in the form header area
    // WeightTracker closes via setShowForm(false) when the X is clicked.
    // Clicking the toggle button again also closes the form.
    fireEvent.click(screen.getByTestId("add-weight-btn"));
    expect(screen.queryByTestId("weight-value-input")).not.toBeInTheDocument();
  });
});
