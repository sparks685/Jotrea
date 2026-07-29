/**
 * Safe-area bottom-padding regression tests
 *
 * These tests assert that the scroll container and BottomNav keep the correct
 * bottom-padding values so content is never hidden behind the nav bar or the
 * device home indicator. They run on every CI pass so a future refactor that
 * accidentally removes the calc() values surfaces immediately.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks (must be declared before any import that would trigger them)
// ---------------------------------------------------------------------------

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
  Link: ({ children, asChild: _a, ...rest }: React.PropsWithChildren<{ asChild?: boolean; href?: string }>) => (
    <a {...rest}>{children}</a>
  ),
  Switch: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Route: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Router: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Redirect: () => null,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("@vercel/speed-insights/react", () => ({ SpeedInsights: () => null }));
vi.mock("@/lib/analytics", () => ({ initGA: vi.fn(), pageView: vi.fn() }));

vi.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("@/pages/Onboarding", () => ({ default: () => <div>Onboarding</div> }));
vi.mock("@/pages/Dashboard", () => ({ default: () => <div data-testid="page-dashboard">Dashboard</div> }));
vi.mock("@/pages/DoseLog", () => ({ default: () => <div data-testid="page-doselog">DoseLog</div> }));
vi.mock("@/pages/WeightTracker", () => ({ default: () => <div>WeightTracker</div> }));
vi.mock("@/pages/MedInfo", () => ({ default: () => <div>MedInfo</div> }));
vi.mock("@/pages/Settings", () => ({ default: () => <div data-testid="page-settings">Settings</div> }));
vi.mock("@/pages/not-found", () => ({ default: () => <div>NotFound</div> }));

// ---------------------------------------------------------------------------
// Import subjects AFTER mocks are registered
// ---------------------------------------------------------------------------

import { BottomNav } from "@/components/BottomNav";
import App from "@/App";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEDICATION_KEY = "jotrea_medication";

function seedMedication() {
  localStorage.setItem(
    MEDICATION_KEY,
    JSON.stringify({
      name: "Ozempic",
      type: "semaglutide",
      startingDose: 0.25,
      currentDose: 0.5,
      frequency: "weekly",
      startDate: "2024-01-01",
    }),
  );
}

// ---------------------------------------------------------------------------
// BottomNav – inline paddingBottom
// ---------------------------------------------------------------------------

describe("BottomNav safe-area padding", () => {
  it("inner row has paddingBottom that includes env(safe-area-inset-bottom)", () => {
    const { container } = render(<BottomNav />);

    // The nav wraps a div with the inline paddingBottom style
    const nav = container.querySelector("nav");
    expect(nav).toBeTruthy();

    const innerRow = nav!.querySelector("[style]");
    expect(innerRow).toBeTruthy();

    const pb = (innerRow as HTMLElement).style.paddingBottom;
    expect(pb).toBeTruthy();
    expect(pb).toMatch(/env\(safe-area-inset-bottom\)/);
  });

  it("nav element is present with data-testid=bottom-nav", () => {
    render(<BottomNav />);
    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// App scroll container – paddingBottom guards last-card visibility
// ---------------------------------------------------------------------------

describe("App scroll container safe-area padding", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMedication();
  });

  it("scroll container paddingBottom uses calc(5rem + env(safe-area-inset-bottom))", () => {
    const { container } = render(<App />);

    // The scroll container is the flex-1 overflow-y-auto div rendered by AppRoutes.
    // It carries an inline paddingBottom when not on the onboarding path.
    const scrollContainer = container.querySelector(".overflow-y-auto");
    expect(scrollContainer).toBeTruthy();

    const pb = (scrollContainer as HTMLElement).style.paddingBottom;
    expect(pb).toBe("calc(5rem + env(safe-area-inset-bottom))");
  });

  // NOTE: paddingTop: "env(safe-area-inset-top)" cannot be asserted through the
  // DOM in jsdom — it strips bare env() values even from the style attribute.
  // The paddingBottom assertion above covers the more critical regression (last
  // card hidden behind the nav bar). The paddingTop value (notch clearance) is
  // visible in App.tsx and caught by code-review.
});
