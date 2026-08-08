/**
 * Corrupted saved profile / weight data — regression tests
 *
 * A malformed `jotrea_user` or `jotrea_weights` in localStorage (partial
 * write, manual tampering, iOS storage eviction) must not be handed to the
 * UI. useWeights falls back to [] for non-array values (mirroring useDoses),
 * and useUser falls back to DEFAULT_USER for structurally invalid records,
 * so Settings and the weight chart never crash on corrupted data.
 */

import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useWeights, useUser, isValidUser } from "@/hooks/useMedication";

const VALID_USER = {
  name: "Sam",
  units: "lbs",
  subscription: "free",
};

beforeEach(() => {
  localStorage.clear();
});

describe("isValidUser", () => {
  it("accepts a well-formed record", () => {
    expect(isValidUser(VALID_USER)).toBe(true);
  });

  it("accepts a record with optional fields", () => {
    expect(
      isValidUser({ ...VALID_USER, units: "kg", subscription: "premium", goalWeightLbs: 150 })
    ).toBe(true);
  });

  it.each([
    ["null", null],
    ["array", []],
    ["string", "sam"],
    ["number", 42],
    ["missing name", { units: "lbs", subscription: "free" }],
    ["non-string name", { ...VALID_USER, name: 7 }],
    ["missing units", { name: "Sam", subscription: "free" }],
    ["invalid units", { ...VALID_USER, units: "stone" }],
    ["missing subscription", { name: "Sam", units: "lbs" }],
    ["invalid subscription", { ...VALID_USER, subscription: "gold" }],
  ])("rejects %s", (_label, value) => {
    expect(isValidUser(value)).toBe(false);
  });
});

describe("useUser defensive read", () => {
  it("returns the user when the stored record is valid", () => {
    localStorage.setItem("jotrea_user", JSON.stringify(VALID_USER));
    const { result } = renderHook(() => useUser());
    expect(result.current.user.name).toBe("Sam");
  });

  it("falls back to DEFAULT_USER for a partial/corrupted record", () => {
    localStorage.setItem("jotrea_user", JSON.stringify({ name: "Sam" }));
    const { result } = renderHook(() => useUser());
    expect(result.current.user).toEqual({ name: "", units: "lbs", subscription: "free" });
  });

  it("falls back to DEFAULT_USER for a non-object record", () => {
    localStorage.setItem("jotrea_user", JSON.stringify("garbage"));
    const { result } = renderHook(() => useUser());
    expect(result.current.user).toEqual({ name: "", units: "lbs", subscription: "free" });
  });

  it("falls back to DEFAULT_USER for an array record", () => {
    localStorage.setItem("jotrea_user", JSON.stringify([VALID_USER]));
    const { result } = renderHook(() => useUser());
    expect(result.current.user).toEqual({ name: "", units: "lbs", subscription: "free" });
  });

  it("falls back to DEFAULT_USER for malformed JSON", () => {
    localStorage.setItem("jotrea_user", "{not json");
    const { result } = renderHook(() => useUser());
    expect(result.current.user).toEqual({ name: "", units: "lbs", subscription: "free" });
  });
});

describe("useWeights defensive read", () => {
  it("returns the weights when the stored value is a valid array", () => {
    const entries = [{ date: "2026-01-01", weight: 200 }];
    localStorage.setItem("jotrea_weights", JSON.stringify(entries));
    const { result } = renderHook(() => useWeights());
    expect(result.current.weights).toEqual(entries);
  });

  it.each([
    ["object", { date: "2026-01-01", weight: 200 }],
    ["string", "not-an-array"],
    ["number", 42],
    ["null", null],
  ])("falls back to [] when the stored value is a non-array (%s)", (_label, value) => {
    localStorage.setItem("jotrea_weights", JSON.stringify(value));
    const { result } = renderHook(() => useWeights());
    expect(result.current.weights).toEqual([]);
  });

  it("falls back to [] for malformed JSON", () => {
    localStorage.setItem("jotrea_weights", "[not json");
    const { result } = renderHook(() => useWeights());
    expect(result.current.weights).toEqual([]);
  });
});
