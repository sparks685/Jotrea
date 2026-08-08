/**
 * Corrupted saved medication — regression tests
 *
 * A malformed `jotrea_medication` in localStorage (partial write, manual
 * tampering, iOS storage eviction) must not be handed to the UI. useMedication
 * validates the stored record on read and returns null for structurally
 * invalid shapes, so App.tsx redirects to onboarding instead of rendering a
 * broken Dashboard.
 */

import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useMedication, isValidMedication } from "@/hooks/useMedication";

const VALID_MED = {
  id: "ozempic",
  genericName: "semaglutide",
  brandName: "Ozempic",
  dose: 0.5,
  frequency: "weekly",
  startDate: "2026-01-01",
  injectionSite: "Abdomen",
  active: true,
};

beforeEach(() => {
  localStorage.clear();
});

describe("isValidMedication", () => {
  it("accepts a well-formed record", () => {
    expect(isValidMedication(VALID_MED)).toBe(true);
  });

  it.each([
    ["null", null],
    ["array", []],
    ["string", "ozempic"],
    ["number", 42],
    ["missing id", { ...VALID_MED, id: undefined }],
    ["empty id", { ...VALID_MED, id: "" }],
    ["non-string id", { ...VALID_MED, id: 7 }],
    ["missing dose", { ...VALID_MED, dose: undefined }],
    ["string dose", { ...VALID_MED, dose: "0.5" }],
    ["NaN dose", { ...VALID_MED, dose: NaN }],
    ["missing startDate", { ...VALID_MED, startDate: undefined }],
    ["missing frequency", { ...VALID_MED, frequency: undefined }],
  ])("rejects %s", (_label, value) => {
    expect(isValidMedication(value)).toBe(false);
  });
});

describe("useMedication defensive read", () => {
  it("returns the medication when the stored record is valid", () => {
    localStorage.setItem("jotrea_medication", JSON.stringify(VALID_MED));
    const { result } = renderHook(() => useMedication());
    expect(result.current.medication?.id).toBe("ozempic");
  });

  it("returns null for a partial/corrupted record", () => {
    localStorage.setItem("jotrea_medication", JSON.stringify({ id: "ozempic" }));
    const { result } = renderHook(() => useMedication());
    expect(result.current.medication).toBeNull();
  });

  it("returns null for a non-object record", () => {
    localStorage.setItem("jotrea_medication", JSON.stringify("garbage"));
    const { result } = renderHook(() => useMedication());
    expect(result.current.medication).toBeNull();
  });

  it("returns null for malformed JSON (falls back to initial value)", () => {
    localStorage.setItem("jotrea_medication", "{not json");
    const { result } = renderHook(() => useMedication());
    expect(result.current.medication).toBeNull();
  });
});
