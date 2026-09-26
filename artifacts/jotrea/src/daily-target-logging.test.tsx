import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, renderHook, within } from "@testing-library/react";
import { format, subDays } from "date-fns";
import { useDailyTargets } from "@/hooks/useDailyTargets";
import { DailyTargetsCard } from "@/components/DailyTargetsCard";
import { computeProgress, mergeLegacyCheckin, resolveGoals, sanitizeStore, emptyStore, DAILY_TARGETS_KEY, DAILY_TARGETS_BACKUP_KEY, isLoggableDate, sanitizeStoreWithReport } from "@/utils/dailyTargets";
import type { UserData } from "@/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));

const user: UserData = { name: "Ana", units: "lbs", subscription: "free", waterGoalCups: 2, proteinGoalG: 50, stepsGoal: 5000 };
const today = () => format(new Date(), "yyyy-MM-dd");
const stored = () => JSON.parse(localStorage.getItem(DAILY_TARGETS_KEY) || "{}");

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("daily target utils", () => {
  it("sanitizes malformed storage", () => {
    expect(sanitizeStore("x")).toEqual(emptyStore());
    const s = sanitizeStore({ cupMl: -1, days: { bad: {}, "2024-01-02": { water: [{ id: "a", amount: "x" }], steps: -4 } } });
    expect(s.cupMl).toBe(240);
    expect(Object.keys(s.days)).toEqual(["2024-01-02"]);
    expect(s.days["2024-01-02"].water).toEqual([]);
    expect(s.days["2024-01-02"].steps).toBeNull();
  });
  it("keeps legacy checkmarks as completion without amounts", () => {
    const s = mergeLegacyCheckin(emptyStore(), { date: "2024-03-01", water: true, protein: false, steps: false });
    const p = computeProgress(s.days["2024-03-01"], resolveGoals(user), 240);
    expect(p.water.complete).toBe(true);
    expect(p.water.legacyOnly).toBe(true);
    expect(p.water.current).toBe(0);
    expect(p.protein.complete).toBe(false);
  });
  it("uses existing goals and defaults", () => {
    expect(resolveGoals({ name: "", units: "lbs", subscription: "free" })).toEqual({ waterCups: 8, proteinG: null, steps: 7000 });
    expect(resolveGoals({ name: "", units: "lbs", subscription: "free", activityLevel: "active" }).steps).toBe(9000);
  });
});

describe("useDailyTargets", () => {
  it("adds, edits, deletes, undoes and persists", () => {
    const { result } = renderHook(() => useDailyTargets());
    const d = result.current.today;
    act(() => result.current.addAmount(d, "water", 240, "a"));
    expect(stored().days[d].water).toHaveLength(1);
    const id = result.current.getDay(d).water[0].id;
    act(() => result.current.updateAmount(d, "water", id, 480));
    expect(result.current.getDay(d).water[0].amount).toBe(480);
    act(() => result.current.undoLast());
    expect(result.current.getDay(d).water[0].amount).toBe(240);
    act(() => result.current.deleteAmount(d, "water", id));
    expect(stored().days[d].water).toHaveLength(0);
    act(() => result.current.undoLast());
    expect(stored().days[d].water).toHaveLength(1);
    const again = renderHook(() => useDailyTargets());
    expect(again.result.current.getDay(d).water[0].amount).toBe(240);
  });
  it("sets steps as a total, not incremental", () => {
    const { result } = renderHook(() => useDailyTargets());
    const d = result.current.today;
    act(() => result.current.setSteps(d, 3000));
    act(() => result.current.setSteps(d, 4200));
    expect(result.current.getDay(d).steps).toBe(4200);
  });
  it("rolls over at local midnight and preserves history", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    vi.setSystemTime(new Date(2024, 4, 10, 23, 59, 0));
    const { result } = renderHook(() => useDailyTargets());
    act(() => result.current.addAmount("2024-05-10", "protein", 30, "p"));
    act(() => { vi.advanceTimersByTime(2 * 60_000); });
    expect(result.current.today).toBe("2024-05-11");
    expect(result.current.getDay("2024-05-11").protein).toHaveLength(0);
    expect(result.current.getDay("2024-05-10").protein[0].amount).toBe(30);
    expect(result.current.historyDates).toContain("2024-05-10");
  });
  it("rolls over on visibility return", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2024, 4, 10, 12));
    const { result } = renderHook(() => useDailyTargets());
    vi.setSystemTime(new Date(2024, 4, 12, 9));
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(result.current.today).toBe("2024-05-12");
  });
});

describe("DailyTargetsCard UI", () => {
  it.each(["light", "dark"])("keeps target icon colors in legacy sRGB in %s mode", (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      render(<DailyTargetsCard user={user} />);
      for (const [key, color] of Object.entries({
        water: "rgb(43, 127, 255)",
        protein: "rgb(255, 100, 103)",
        steps: "rgb(0, 201, 80)",
      })) {
        const icon = screen.getByTestId(`daily-target-${key}`).querySelector("svg");
        expect(icon).toHaveStyle({ color });
        expect(icon).toHaveAttribute("stroke", "currentColor");
        expect(icon?.getAttribute("class")).not.toMatch(/text-(blue|red|green)-/);
      }
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
  it("gives every target its own full-width natural-height row and in-flow progress", () => {
    render(<DailyTargetsCard user={user} />);
    const card = screen.getByRole("region", { name: "Today's Targets" });
    expect(within(card).getAllByRole("button")).toHaveLength(3);
    for (const key of ["water", "protein", "steps"]) {
      const row = screen.getByTestId(`daily-target-${key}`);
      expect(row).toHaveClass("daily-target-row");
      expect(row.parentElement).toHaveClass("daily-targets-list");
      expect(row.querySelector(".daily-target-progress")).not.toBeNull();
      expect(row).toHaveAttribute("aria-haspopup", "dialog");
      expect(row.className).not.toContain("overflow-hidden");
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // jsdom cannot measure geometry. These assertions protect the structural
    // contract separately from browser/native visual verification.
    const dashboardLayoutCss = readFileSync(resolve(process.cwd(), "src/pages/dashboard-layout.css"), "utf8");
    expect(dashboardLayoutCss).toMatch(/\.daily-targets-list\s*\{[^}]*flex-direction: column/s);
    expect(dashboardLayoutCss).toMatch(/\.daily-target-row\s*\{[^}]*flex: none;[^}]*width: 100%;[^}]*height: auto;/s);
    expect(dashboardLayoutCss).toMatch(/\.dashboard-layout\s*\{[^}]*gap: 24px;[^}]*height: auto;/s);
    expect(dashboardLayoutCss).toMatch(/\.dashboard-layout > \*\s*\{[^}]*flex: none;/s);
    expect(dashboardLayoutCss).not.toMatch(/position:\s*(absolute|fixed)|overflow:\s*hidden/);
  });
  it("announces logged amounts and goals, and handles an unset protein goal", () => {
    render(<DailyTargetsCard user={{ ...user, proteinGoalG: undefined }} />);
    expect(screen.getByTestId("daily-target-water")).toHaveAccessibleName(/Water: 0 cups logged, goal 2 cups/);
    expect(screen.getByTestId("daily-target-protein")).toHaveAccessibleName(/no goal set/);
    expect(screen.getByText("No protein goal set")).toBeInTheDocument();
  });
  it("quick-adds water, completes goal, undoes", () => {
    render(<DailyTargetsCard user={user} />);
    fireEvent.click(screen.getByTestId("daily-target-water"));
    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(sheet).getByTestId("button-quick-water-480"));
    expect(screen.getByTestId("daily-target-water")).toHaveAttribute("data-complete", "true");
    expect(screen.getByTestId("text-logged-water")).toHaveTextContent("2 cups logged");
    const fill = screen.getByTestId("daily-target-water").querySelector(".daily-target-progress > span");
    expect(fill).toHaveStyle({ width: "100%" });
    expect(fill).not.toHaveAttribute("style", expect.stringContaining("transform"));
    expect(fill?.className).not.toContain("transition");
    fireEvent.click(screen.getByTestId("button-undo"));
    expect(screen.getByTestId("daily-target-water")).toHaveAttribute("data-complete", "false");
  });
  it("custom protein, validation, edit and delete", () => {
    render(<DailyTargetsCard user={user} />);
    fireEvent.click(screen.getByTestId("daily-target-protein"));
    fireEvent.change(screen.getByTestId("input-custom-amount"), { target: { value: "abc" } });
    fireEvent.click(screen.getByTestId("button-add-custom"));
    expect(screen.getByTestId("text-target-error")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("input-custom-amount"), { target: { value: "25" } });
    fireEvent.click(screen.getByTestId("button-add-custom"));
    const id = stored().days[today()].protein[0].id;
    fireEvent.click(screen.getByTestId(`button-edit-${id}`));
    fireEvent.change(screen.getByTestId(`input-edit-${id}`), { target: { value: "55" } });
    fireEvent.click(screen.getByTestId(`button-save-edit-${id}`));
    expect(screen.getByTestId("daily-target-protein")).toHaveAttribute("data-complete", "true");
    fireEvent.click(screen.getByTestId(`button-delete-${id}`));
    expect(screen.getByTestId("text-no-entries")).toBeInTheDocument();
  });
  it("corrects a previous day's steps from history", () => {
    const y = format(subDays(new Date(), 1), "yyyy-MM-dd");
    localStorage.setItem(DAILY_TARGETS_KEY, JSON.stringify({ version: 1, cupMl: 240, days: { [y]: { date: y, water: [], protein: [], steps: 100 } } }));
    render(<DailyTargetsCard user={user} />);
    fireEvent.click(screen.getByTestId("daily-target-steps"));
    fireEvent.click(screen.getByTestId("button-toggle-history"));
    fireEvent.click(screen.getByTestId(`button-history-${y}`));
    fireEvent.change(screen.getByTestId("input-steps-total"), { target: { value: "6000" } });
    fireEvent.click(screen.getByTestId("button-save-steps"));
    expect(stored().days[y].steps).toBe(6000);
    expect(screen.getByTestId("daily-target-steps")).toHaveAttribute("data-complete", "false");
  });
  it("shows legacy checkmark completion and updates with goal changes", () => {
    localStorage.setItem("jotrea_daily_checkin", JSON.stringify({ date: today(), water: false, protein: false, steps: true }));
    const { rerender } = render(<DailyTargetsCard user={user} />);
    expect(screen.getByTestId("daily-target-steps")).toHaveAttribute("data-complete", "true");
    expect(screen.getByTestId("text-logged-steps")).toHaveTextContent("Legacy check");
    fireEvent.click(screen.getByTestId("daily-target-water"));
    fireEvent.click(screen.getByTestId("button-quick-water-240"));
    expect(screen.getByTestId("daily-target-water")).toHaveAttribute("data-complete", "false");
    rerender(<DailyTargetsCard user={{ ...user, waterGoalCups: 1 }} />);
    expect(screen.getByTestId("daily-target-water")).toHaveAttribute("data-complete", "true");
  });
  it("closes with Escape", () => {
    render(<DailyTargetsCard user={user} />);
    fireEvent.click(screen.getByTestId("daily-target-steps"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("audit hardening", () => {
  it("rejects impossible and future dates, non-integer steps", () => {
    expect(isLoggableDate("2024-02-30", "2024-05-01")).toBe(false);
    expect(isLoggableDate("2024-05-02", "2024-05-01")).toBe(false);
    expect(isLoggableDate("2024-04-30", "2024-05-01")).toBe(true);
    const { result } = renderHook(() => useDailyTargets());
    const future = format(new Date(Date.now() + 3 * 86400000), "yyyy-MM-dd");
    act(() => result.current.addAmount(future, "water", 240, "x"));
    act(() => result.current.addAmount("2024-02-31", "water", 240, "x"));
    act(() => result.current.setSteps(result.current.today, 12.5));
    expect(localStorage.getItem(DAILY_TARGETS_KEY)).toBeNull();
  });
  it("handles rapid quick-adds without losing entries", () => {
    render(<DailyTargetsCard user={user} />);
    fireEvent.click(screen.getByTestId("daily-target-water"));
    const btn = screen.getByTestId("button-quick-water-120");
    for (let i = 0; i < 6; i++) fireEvent.click(btn);
    expect(stored().days[today()].water).toHaveLength(6);
    expect(screen.getByTestId("text-logged-water")).toHaveTextContent("3 cups logged");
  });
  it("cup size change keeps a concurrent fresh write", () => {
    const a = renderHook(() => useDailyTargets());
    const b = renderHook(() => useDailyTargets());
    const d = a.result.current.today;
    // simulate a write from elsewhere that b's in-memory copy has not seen
    localStorage.setItem(DAILY_TARGETS_KEY, JSON.stringify({ version: 1, cupMl: 240, days: { [d]: { date: d, water: [{ id: "z", amount: 300, loggedAt: new Date().toISOString() }], protein: [], steps: null } } }));
    act(() => b.result.current.setCupMl(330));
    expect(stored().cupMl).toBe(330);
    expect(stored().days[d].water).toHaveLength(1);
    a.unmount();
  });
  it("backs up malformed raw data before first write and warns", () => {
    const bad = { version: 1, cupMl: 240, days: { "2024-01-01": { date: "2024-01-01", water: [{ id: "a", amount: "lots" }], protein: [], steps: null }, nope: 1 } };
    expect(sanitizeStoreWithReport(bad).issues).toBeGreaterThan(0);
    localStorage.setItem(DAILY_TARGETS_KEY, JSON.stringify(bad));
    render(<DailyTargetsCard user={user} />);
    fireEvent.click(screen.getByTestId("daily-target-water"));
    expect(screen.getByTestId("warning-malformed-data")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-quick-water-240"));
    const backup = JSON.parse(localStorage.getItem(DAILY_TARGETS_BACKUP_KEY)!);
    expect(JSON.parse(backup.raw)).toEqual(bad);
    fireEvent.click(screen.getByTestId("button-quick-water-240"));
    expect(JSON.parse(JSON.parse(localStorage.getItem(DAILY_TARGETS_BACKUP_KEY)!).raw)).toEqual(bad);
  });
  it("backs up unparseable JSON", () => {
    localStorage.setItem(DAILY_TARGETS_KEY, "{not json");
    const { result } = renderHook(() => useDailyTargets());
    expect(result.current.dataWarning).toBe(true);
    act(() => result.current.setSteps(result.current.today, 10));
    expect(JSON.parse(localStorage.getItem(DAILY_TARGETS_BACKUP_KEY)!).raw).toBe("{not json");
  });
  it("preserves the legacy record and its original date on first action and new day", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    vi.setSystemTime(new Date(2024, 4, 10, 23, 59, 0));
    const legacy = JSON.stringify({ date: "2024-05-11", water: true, protein: false, steps: false });
    localStorage.setItem("jotrea_daily_checkin", legacy);
    const { result } = renderHook(() => useDailyTargets());
    act(() => result.current.addAmount("2024-05-10", "water", 240, "a"));
    expect(localStorage.getItem("jotrea_daily_checkin")).toBe(legacy);
    expect(stored().days["2024-05-11"].legacy.water).toBe(true);
    expect(stored().days["2024-05-10"].legacy).toBeUndefined();
    act(() => { vi.advanceTimersByTime(2 * 60_000); });
    expect(result.current.today).toBe("2024-05-11");
    act(() => result.current.addAmount("2024-05-11", "protein", 10, "b"));
    expect(stored().days["2024-05-11"].legacy.water).toBe(true);
    expect(stored().days["2024-05-11"].water).toHaveLength(0);
    expect(localStorage.getItem("jotrea_daily_checkin")).toBe(legacy);
  });
  it("traps focus, restores it on close, and uses type=button", () => {
    render(<DailyTargetsCard user={user} />);
    const opener = screen.getByTestId("daily-target-steps");
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    dialog.querySelectorAll("button").forEach((b) => expect(b).toHaveAttribute("type", "button"));
    const focusables = dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])");
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(focusables[0]);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });
});
