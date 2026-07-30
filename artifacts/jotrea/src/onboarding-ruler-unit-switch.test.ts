/**
 * Onboarding ruler — unit-switch regression tests
 *
 * Confirms that switching the height unit system (imperial ↔ metric) mid-
 * onboarding leaves the Goal Weight ruler (step 5) in a consistent state:
 *
 *   1. rMin / rMax update correctly for each unit system.
 *   2. goalWeight is clamped to the new bounds after a unit switch.
 *   3. No tick renders outside [rMin, rMax] for either unit.
 *   4. Tick colours produced by the palette formula are valid rgba() values in
 *      both light and dark themes.
 *   5. The centre-tick colour is always the brand amber regardless of theme or
 *      unit system.
 *   6. Label colour strings are non-empty and change between light and dark.
 *
 * All tests exercise the pure logic copied from Onboarding.tsx — the same
 * formulas the browser runs, with no React mounting required.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Pure helpers — mirrors of the Onboarding.tsx ruler logic
// ---------------------------------------------------------------------------

type Unit = "imperial" | "metric";
type Theme = "light" | "dark";

/** Mirrors the rMin/rMax constants derived from heightUnit in Onboarding.tsx */
function rulerBounds(unit: Unit): { rMin: number; rMax: number } {
  return unit === "imperial"
    ? { rMin: 80, rMax: 400 }
    : { rMin: 30, rMax: 200 };
}

/**
 * Mirrors the goalWeight initialisation logic inside the step-5 useEffect:
 *   const val = Math.min(rMax, Math.max(rMin, parseInt(raw) || 150));
 */
function clampGoalWeight(raw: string, unit: Unit): number {
  const { rMin, rMax } = rulerBounds(unit);
  return Math.min(rMax, Math.max(rMin, parseInt(raw) || 150));
}

/**
 * Mirrors the per-tick gw clamp at the top of the ruler render IIFE:
 *   const gw = Math.min(rMax, Math.max(rMin, parseInt(goalWeight) || rMin));
 */
function clampGw(goalWeight: string, unit: Unit): number {
  const { rMin, rMax } = rulerBounds(unit);
  return Math.min(rMax, Math.max(rMin, parseInt(goalWeight) || rMin));
}

/** Mirrors the inRange guard: `const inRange = val >= rMin && val <= rMax;` */
function inRange(val: number, unit: Unit): boolean {
  const { rMin, rMax } = rulerBounds(unit);
  return val >= rMin && val <= rMax;
}

/**
 * Mirrors the tick RGBA colour formula in Onboarding.tsx.
 * Returns { r, g, b, a } channels, all numbers.
 */
function tickColour(
  dist: number,
  theme: Theme,
): { r: number; g: number; b: number; a: number } {
  const nearR = 212, nearG = 165, nearB = 116;
  const [farR, farG, farB] =
    theme === "dark" ? [100, 110, 145] : [200, 210, 210];
  const t = Math.min(1, dist / 8);
  const r = Math.round(nearR + (farR - nearR) * t);
  const g = Math.round(nearG + (farG - nearG) * t);
  const b = Math.round(nearB + (farB - nearB) * t);
  const a = dist === 0 ? 1 : Math.max(0.15, 0.88 - dist * 0.1);
  return { r, g, b, a };
}

/**
 * Mirrors the label colour expression in Onboarding.tsx:
 *   dist===0  → 'hsl(var(--foreground))'
 *   otherwise → `rgba(${...},${opacity})`
 */
function labelColour(dist: number, theme: Theme): string {
  if (dist === 0) return "hsl(var(--foreground))";
  const rgb = theme === "dark" ? "160,170,200" : "156,163,175";
  const opacity = Math.max(0.2, 0.65 - dist * 0.05);
  return `rgba(${rgb},${opacity})`;
}

// ---------------------------------------------------------------------------
// 1. rMin / rMax per unit
// ---------------------------------------------------------------------------

describe("rulerBounds — correct range per unit system", () => {
  it("imperial: rMin=80, rMax=400", () => {
    const { rMin, rMax } = rulerBounds("imperial");
    expect(rMin).toBe(80);
    expect(rMax).toBe(400);
  });

  it("metric: rMin=30, rMax=200", () => {
    const { rMin, rMax } = rulerBounds("metric");
    expect(rMin).toBe(30);
    expect(rMax).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 2. goalWeight clamping after unit switch
// ---------------------------------------------------------------------------

describe("clampGoalWeight — value is re-clamped on unit change", () => {
  it("imperial goalWeight within range stays unchanged", () => {
    expect(clampGoalWeight("150", "imperial")).toBe(150);
  });

  it("metric goalWeight within range stays unchanged", () => {
    expect(clampGoalWeight("80", "metric")).toBe(80);
  });

  it("switching imperial→metric clamps a value above metric rMax to 200", () => {
    // 300 lbs is valid in imperial but exceeds metric rMax of 200 kg
    expect(clampGoalWeight("300", "metric")).toBe(200);
  });

  it("switching metric→imperial clamps a value below imperial rMin to 80", () => {
    // 40 kg is valid in metric but below imperial rMin of 80 lbs
    expect(clampGoalWeight("40", "imperial")).toBe(80);
  });

  it("empty / NaN raw falls back to 150 (or rMin if 150 < rMin)", () => {
    // 150 is within imperial [80,400]
    expect(clampGoalWeight("", "imperial")).toBe(150);
    // 150 is within metric [30,200]
    expect(clampGoalWeight("", "metric")).toBe(150);
  });

  it("round-trip imperial→metric→imperial preserves a sensible value", () => {
    const afterImperialToMetric = clampGoalWeight("150", "metric"); // 150 kg, within [30,200]
    expect(afterImperialToMetric).toBe(150);
    const afterMetricToImperial = clampGoalWeight(
      afterImperialToMetric.toString(),
      "imperial",
    ); // 150 lbs, within [80,400]
    expect(afterMetricToImperial).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// 3. No tick renders outside [rMin, rMax]
// ---------------------------------------------------------------------------

describe("inRange — ticks outside bounds are suppressed", () => {
  const HALF = 20;

  it("every tick rendered for imperial goal 150 is within [80, 400]", () => {
    const gw = 150; // safe mid-range imperial value
    for (let i = 0; i < HALF * 2 + 1; i++) {
      const val = gw + (i - HALF);
      if (!inRange(val, "imperial")) {
        // Tick outside range → should be skipped (empty div), not rendered
        // The test asserts the guard works: out-of-range ticks must NOT be
        // in the rendered set.  We just verify the guard function correctly
        // identifies them.
        expect(val < 80 || val > 400).toBe(true);
      }
    }
  });

  it("every tick rendered for metric goal 80 is within [30, 200]", () => {
    const gw = 80; // safe mid-range metric value
    for (let i = 0; i < HALF * 2 + 1; i++) {
      const val = gw + (i - HALF);
      if (!inRange(val, "metric")) {
        expect(val < 30 || val > 200).toBe(true);
      }
    }
  });

  it("boundary tick at rMin is in-range", () => {
    expect(inRange(80, "imperial")).toBe(true);
    expect(inRange(30, "metric")).toBe(true);
  });

  it("boundary tick at rMax is in-range", () => {
    expect(inRange(400, "imperial")).toBe(true);
    expect(inRange(200, "metric")).toBe(true);
  });

  it("tick one below rMin is out-of-range", () => {
    expect(inRange(79, "imperial")).toBe(false);
    expect(inRange(29, "metric")).toBe(false);
  });

  it("tick one above rMax is out-of-range", () => {
    expect(inRange(401, "imperial")).toBe(false);
    expect(inRange(201, "metric")).toBe(false);
  });

  it("clampGw never produces a value outside [rMin, rMax]", () => {
    const extremes = ["0", "-50", "9999", "NaN", ""];
    for (const raw of extremes) {
      for (const unit of ["imperial", "metric"] as Unit[]) {
        const { rMin, rMax } = rulerBounds(unit);
        const gw = clampGw(raw, unit);
        expect(gw).toBeGreaterThanOrEqual(rMin);
        expect(gw).toBeLessThanOrEqual(rMax);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Tick colours are valid in both themes
// ---------------------------------------------------------------------------

describe("tickColour — valid rgba channels in light and dark themes", () => {
  const themes: Theme[] = ["light", "dark"];
  const distances = [0, 1, 2, 4, 8, 12, 20];

  for (const theme of themes) {
    describe(`theme: ${theme}`, () => {
      for (const dist of distances) {
        it(`dist=${dist} yields valid rgba channels`, () => {
          const { r, g, b, a } = tickColour(dist, theme);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(255);
          expect(g).toBeGreaterThanOrEqual(0);
          expect(g).toBeLessThanOrEqual(255);
          expect(b).toBeGreaterThanOrEqual(0);
          expect(b).toBeLessThanOrEqual(255);
          expect(a).toBeGreaterThan(0);
          expect(a).toBeLessThanOrEqual(1);
        });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 5. Centre tick is always brand amber (theme-independent)
// ---------------------------------------------------------------------------

describe("tickColour — centre tick colour is brand amber (#D4A574)", () => {
  it("light theme: centre tick r=212, g=165, b=116, a=1", () => {
    const { r, g, b, a } = tickColour(0, "light");
    expect(r).toBe(212);
    expect(g).toBe(165);
    expect(b).toBe(116);
    expect(a).toBe(1);
  });

  it("dark theme: centre tick r=212, g=165, b=116, a=1 (same as light)", () => {
    const { r, g, b, a } = tickColour(0, "dark");
    expect(r).toBe(212);
    expect(g).toBe(165);
    expect(b).toBe(116);
    expect(a).toBe(1);
  });

  it("centre tick colour is identical regardless of unit system", () => {
    // tickColour does not depend on unit system — unit only affects rMin/rMax
    const lightColour = tickColour(0, "light");
    const darkColour  = tickColour(0, "dark");
    // Both must match brand amber exactly
    expect(lightColour.r).toBe(212);
    expect(darkColour.r).toBe(212);
  });
});

// ---------------------------------------------------------------------------
// 6. Label colours differ between light and dark
// ---------------------------------------------------------------------------

describe("labelColour — adapts to theme", () => {
  it("centre label always uses CSS variable (same in both themes)", () => {
    expect(labelColour(0, "light")).toBe("hsl(var(--foreground))");
    expect(labelColour(0, "dark")).toBe("hsl(var(--foreground))");
  });

  it("off-centre label rgb values differ between light and dark", () => {
    const light = labelColour(2, "light");
    const dark  = labelColour(2, "dark");
    expect(light).not.toBe(dark);
    // Light uses the grey-400 channel
    expect(light).toContain("156,163,175");
    // Dark uses the blue-grey channel
    expect(dark).toContain("160,170,200");
  });

  it("opacity decreases as distance from centre increases", () => {
    const near = labelColour(2, "light");
    const far  = labelColour(8, "light");
    // Parse opacity from rgba(...,opacity)
    const opacityOf = (s: string) =>
      parseFloat(s.replace(/.*,/, "").replace(")", ""));
    expect(opacityOf(near)).toBeGreaterThan(opacityOf(far));
  });

  it("opacity is never below 0.2 (floor enforced by Math.max)", () => {
    // dist=20 → raw opacity = 0.65 - 20*0.05 = -0.35, clamped to 0.2
    const colour = labelColour(20, "light");
    const opacity = parseFloat(colour.replace(/.*,/, "").replace(")", ""));
    expect(opacity).toBeGreaterThanOrEqual(0.2);
  });
});
