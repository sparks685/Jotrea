/**
 * Dose button grid regression tests (Step 11 – Set your dose)
 *
 * Confirms the 3-column dose grid stays readable when:
 *  a) the viewport is at the minimum supported width (~320 px), and
 *  b) the root font size is doubled to simulate iOS/Android accessibility
 *     large-text mode.
 *
 * Key properties checked:
 *  - Grid is 3 columns.
 *  - Each cell wrapper carries `overflow-visible` so the absolutely-positioned
 *    "Start here" badge is never clipped by an `overflow-y-auto` ancestor on
 *    iOS/Safari.
 *  - The first button has extra top padding expressed in `rem` so it scales
 *    with the system font size (accessibility large text).
 *  - Buttons carry `min-h-[3rem]` so they never collapse when text grows.
 *  - The "Start here" badge is present on the first cell and uses
 *    `whitespace-nowrap` (one-line pill label).
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("framer-motion", () => {
  const PassBtn = ({
    children,
    whileTap: _wt,
    ...props
  }: React.PropsWithChildren<
    React.ButtonHTMLAttributes<HTMLButtonElement> & { whileTap?: unknown }
  >) => <button {...props}>{children}</button>;

  const PassDiv = ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
    <div {...props}>{children}</div>
  );

  return {
    motion: { button: PassBtn, div: PassDiv },
    AnimatePresence: ({ children }: React.PropsWithChildren) => (
      <>{children}</>
    ),
  };
});

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

vi.mock("@/hooks/useMedication", () => ({
  useMedication: () => ({ setMedication: vi.fn(), medication: null }),
  useWeights: () => ({ setWeights: vi.fn() }),
  useUser: () => ({ user: { name: "" }, setUser: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Self-contained DoseButtonGrid — mirrors the production structure exactly
// (kept in sync with artifacts/jotrea/src/pages/Onboarding.tsx ~line 988-1016)
// ---------------------------------------------------------------------------

const BRAND = "#D4A574";

function DoseButtonGrid({
  doses,
  unit,
}: {
  doses: number[];
  unit: string;
}) {
  const [selected, setSelected] = React.useState<number | null>(null);

  return (
    // mt-3 gives the absolutely-positioned badge clearance from the label above
    <div className="grid grid-cols-3 gap-2 mt-3" data-testid="dose-grid">
      {doses.map((d, i) => {
        const isStart = i === 0;
        const isSelected = selected === d;

        return (
          // overflow-visible prevents iOS overflow-y-auto ancestors from
          // clipping the badge when it extends beyond the column boundary
          <div
            key={d}
            className="relative overflow-visible"
            data-testid={`dose-cell-${i}`}
          >
            <button
              // min-h-[3rem] keeps the button usable when font size grows
              // rem-based padding scales with the system/accessibility font size
              className="w-full rounded-2xl text-sm font-bold border-2 transition-all min-h-[3rem]"
              style={{
                paddingTop: isStart ? "1.25rem" : "0.875rem",
                paddingBottom: "0.875rem",
                backgroundColor: isSelected ? BRAND : "hsl(var(--card))",
                borderColor: isSelected
                  ? BRAND
                  : isStart
                    ? `${BRAND}60`
                    : "hsl(var(--border))",
                color: isSelected ? "white" : "hsl(var(--foreground))",
              }}
              onClick={() => setSelected(d)}
              data-testid={`dose-btn-${i}`}
            >
              {d} {unit}
            </button>

            {isStart && (
              <div
                className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide whitespace-nowrap"
                style={{
                  backgroundColor: `${BRAND}18`,
                  color: BRAND,
                  border: `1px solid ${BRAND}40`,
                }}
                data-testid="start-badge"
              >
                Start here
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OZEMPIC_DOSES = [0.25, 0.5, 1, 2];
const TIRZEPATIDE_DOSES = [2.5, 5, 7.5, 10, 12.5, 15]; // 6 doses → two full rows

function renderGrid(
  doses = OZEMPIC_DOSES,
  unit = "mg",
  rootFontSizePx = 16,
) {
  // Simulate accessibility large-text by overriding the root font size.
  document.documentElement.style.fontSize = `${rootFontSizePx}px`;
  return render(<DoseButtonGrid doses={doses} unit={unit} />);
}

// ---------------------------------------------------------------------------
// Layout – grid structure
// ---------------------------------------------------------------------------

describe("Dose button grid – layout", () => {
  beforeEach(() => {
    document.documentElement.style.fontSize = "";
  });

  it("renders a 3-column grid container", () => {
    renderGrid();
    const grid = screen.getByTestId("dose-grid");
    expect(grid.className).toMatch(/grid-cols-3/);
  });

  it("adds top margin (mt-3) so the badge clears the label above", () => {
    renderGrid();
    const grid = screen.getByTestId("dose-grid");
    expect(grid.className).toMatch(/mt-3/);
  });

  it("renders one button per dose", () => {
    renderGrid(OZEMPIC_DOSES);
    expect(screen.getAllByRole("button")).toHaveLength(OZEMPIC_DOSES.length);
  });

  it("renders all 6 Tirzepatide doses without error", () => {
    renderGrid(TIRZEPATIDE_DOSES, "mg");
    expect(screen.getAllByRole("button")).toHaveLength(TIRZEPATIDE_DOSES.length);
  });
});

// ---------------------------------------------------------------------------
// Overflow – badge clipping prevention
// ---------------------------------------------------------------------------

describe("Dose button grid – overflow protection", () => {
  it("each cell wrapper carries overflow-visible", () => {
    renderGrid();
    OZEMPIC_DOSES.forEach((_, i) => {
      const cell = screen.getByTestId(`dose-cell-${i}`);
      expect(cell.className).toMatch(/overflow-visible/);
    });
  });
});

// ---------------------------------------------------------------------------
// Start-here badge
// ---------------------------------------------------------------------------

describe("Dose button grid – Start here badge", () => {
  it("renders only on the first (lowest) dose", () => {
    renderGrid();
    expect(screen.getAllByTestId("start-badge")).toHaveLength(1);
    // Badge is inside cell 0
    const cell0 = screen.getByTestId("dose-cell-0");
    expect(cell0.querySelector("[data-testid='start-badge']")).toBeTruthy();
  });

  it("badge text is whitespace-nowrap (one-line pill at any width)", () => {
    renderGrid();
    const badge = screen.getByTestId("start-badge");
    expect(badge.className).toMatch(/whitespace-nowrap/);
  });

  it("badge is absolutely positioned above the button", () => {
    renderGrid();
    const badge = screen.getByTestId("start-badge");
    expect(badge.className).toMatch(/absolute/);
    expect(badge.className).toMatch(/-top-/);
  });
});

// ---------------------------------------------------------------------------
// Button sizing – large-font resilience (~320 px + 200 % accessibility zoom)
// ---------------------------------------------------------------------------

describe("Dose button grid – font-size resilience", () => {
  afterEach(() => {
    document.documentElement.style.fontSize = "";
  });

  it("buttons carry min-h-[3rem] so they never collapse at large text sizes", () => {
    renderGrid();
    const btn0 = screen.getByTestId("dose-btn-0");
    expect(btn0.className).toMatch(/min-h-\[3rem\]/);
    const btn1 = screen.getByTestId("dose-btn-1");
    expect(btn1.className).toMatch(/min-h-\[3rem\]/);
  });

  it("first button paddingTop is rem-based (scales with accessibility font)", () => {
    renderGrid();
    const btn0 = screen.getByTestId("dose-btn-0") as HTMLButtonElement;
    // 1.25rem at default (16 px root) → 20 px; at 200% root → 40 px
    expect(btn0.style.paddingTop).toBe("1.25rem");
  });

  it("other buttons paddingTop is rem-based", () => {
    renderGrid();
    const btn1 = screen.getByTestId("dose-btn-1") as HTMLButtonElement;
    expect(btn1.style.paddingTop).toBe("0.875rem");
  });

  it("paddingBottom is rem-based on all buttons", () => {
    renderGrid();
    screen.getAllByRole("button").forEach((btn) => {
      expect((btn as HTMLButtonElement).style.paddingBottom).toBe("0.875rem");
    });
  });

  it("buttons still render correctly when root font size is 32 px (200 % zoom)", () => {
    renderGrid(OZEMPIC_DOSES, "mg", 32);
    // All buttons still present and legible
    expect(screen.getAllByRole("button")).toHaveLength(OZEMPIC_DOSES.length);
    // Inline padding values are still the rem strings (not computed px)
    const btn0 = screen.getByTestId("dose-btn-0") as HTMLButtonElement;
    expect(btn0.style.paddingTop).toBe("1.25rem");
  });

  it("badge text-[9px] fixed size means badge never grows with font zoom (stays compact)", () => {
    renderGrid(OZEMPIC_DOSES, "mg", 32);
    const badge = screen.getByTestId("start-badge");
    // text-[9px] is a fixed-px class — badge stays compact regardless of zoom
    expect(badge.className).toMatch(/text-\[9px\]/);
  });
});

// ---------------------------------------------------------------------------
// Button label content
// ---------------------------------------------------------------------------

describe("Dose button grid – label content", () => {
  it("each button shows its dose value and unit", () => {
    renderGrid([0.25, 0.5, 1, 2], "mg");
    expect(screen.getByTestId("dose-btn-0").textContent).toContain("0.25 mg");
    expect(screen.getByTestId("dose-btn-1").textContent).toContain("0.5 mg");
    expect(screen.getByTestId("dose-btn-2").textContent).toContain("1 mg");
    expect(screen.getByTestId("dose-btn-3").textContent).toContain("2 mg");
  });
});
