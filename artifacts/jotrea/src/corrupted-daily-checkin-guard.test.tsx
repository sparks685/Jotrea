/**
 * Corrupted daily check-in data — regression tests
 *
 * A malformed `jotrea_daily_checkin` in localStorage (partial write, manual
 * tampering, iOS storage eviction) must not crash the Daily Targets card on
 * the home screen. useDailyCheckin validates the stored value on every read
 * and falls back to today's all-false default when the record is structurally
 * invalid.
 */

import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useDailyCheckin, isValidDailyCheckin } from "@/hooks/useMedication";

const VALID_CHECKIN = {
  date: "2026-08-08",
  water: true,
  protein: false,
  steps: true,
};

beforeEach(() => {
  localStorage.clear();
});

describe("isValidDailyCheckin", () => {
  it("accepts a well-formed record", () => {
    expect(isValidDailyCheckin(VALID_CHECKIN)).toBe(true);
  });

  it("accepts all-false flags", () => {
    expect(
      isValidDailyCheckin({ date: "2026-08-08", water: false, protein: false, steps: false })
    ).toBe(true);
  });

  it.each([
    ["null", null],
    ["array", []],
    ["string", "2026-08-08"],
    ["number", 42],
    ["missing date", { water: false, protein: false, steps: false }],
    ["non-string date", { ...VALID_CHECKIN, date: 20260808 }],
    ["empty string date", { ...VALID_CHECKIN, date: "" }],
    ["missing water", { date: "2026-08-08", protein: false, steps: false }],
    ["non-boolean water", { ...VALID_CHECKIN, water: 1 }],
    ["missing protein", { date: "2026-08-08", water: false, steps: false }],
    ["non-boolean protein", { ...VALID_CHECKIN, protein: "yes" }],
    ["missing steps", { date: "2026-08-08", water: false, protein: false }],
    ["non-boolean steps", { ...VALID_CHECKIN, steps: null }],
  ])("rejects %s", (_label, value) => {
    expect(isValidDailyCheckin(value)).toBe(false);
  });
});

describe("useDailyCheckin defensive read", () => {
  it("returns the stored checkin when it is valid and from today", () => {
    const today = new Date().toISOString().slice(0, 10);
    const stored = { date: today, water: true, protein: false, steps: true };
    localStorage.setItem("jotrea_daily_checkin", JSON.stringify(stored));
    const { result } = renderHook(() => useDailyCheckin());
    expect(result.current.checkin.water).toBe(true);
    expect(result.current.checkin.steps).toBe(true);
  });

  it("resets to all-false when the stored date is a previous day", () => {
    const stored = { date: "2020-01-01", water: true, protein: true, steps: true };
    localStorage.setItem("jotrea_daily_checkin", JSON.stringify(stored));
    const { result } = renderHook(() => useDailyCheckin());
    expect(result.current.checkin.water).toBe(false);
    expect(result.current.checkin.protein).toBe(false);
    expect(result.current.checkin.steps).toBe(false);
  });

  it.each([
    ["a plain string", JSON.stringify("not-an-object")],
    ["a number", JSON.stringify(42)],
    ["null", JSON.stringify(null)],
    ["an array", JSON.stringify([{ date: "2026-08-08", water: true, protein: false, steps: false }])],
    ["a partial object (missing flags)", JSON.stringify({ date: "2026-08-08" })],
    ["non-boolean flags", JSON.stringify({ date: "2026-08-08", water: 1, protein: 0, steps: 1 })],
    ["malformed JSON", "{not json"],
  ])("falls back to today's all-false default when stored value is %s", (_label, raw) => {
    localStorage.setItem("jotrea_daily_checkin", raw);
    const { result } = renderHook(() => useDailyCheckin());
    const today = new Date().toISOString().slice(0, 10);
    expect(result.current.checkin.date).toBe(today);
    expect(result.current.checkin.water).toBe(false);
    expect(result.current.checkin.protein).toBe(false);
    expect(result.current.checkin.steps).toBe(false);
  });
});
