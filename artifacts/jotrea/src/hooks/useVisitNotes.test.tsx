import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { useVisitNotes } from "./useVisitNotes";
import type { VisitNote } from "@/types";

describe("useVisitNotes", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array by default", () => {
    const { result } = renderHook(() => useVisitNotes());
    expect(result.current.notes).toEqual([]);
  });

  it("persists notes across hook calls", () => {
    const { result, rerender } = renderHook(() => useVisitNotes());
    
    const testNote: VisitNote = {
      id: "test-id",
      visitDate: "2024-01-01",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      providerName: "Dr. Test",
      includeInProviderSummary: false,
    };

    act(() => {
      result.current.setNotes([testNote]);
    });

    rerender();
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0]).toEqual(testNote);

    // Verify localStorage
    const stored = JSON.parse(localStorage.getItem("jotrea_visit_notes") || "[]");
    expect(stored[0].id).toBe("test-id");
  });

  it("defensively falls back to empty array if stored data is corrupted", () => {
    localStorage.setItem("jotrea_visit_notes", '{"invalid": "data"}'); // not an array
    const { result } = renderHook(() => useVisitNotes());
    expect(result.current.notes).toEqual([]);
  });

  it("filters malformed entries and keeps valid visit notes", () => {
    localStorage.setItem("jotrea_visit_notes", JSON.stringify([
      {
        id: "valid",
        visitDate: "2026-09-07",
        createdAt: "2026-09-07T12:00:00.000Z",
        updatedAt: "2026-09-07T12:00:00.000Z",
        includeInProviderSummary: false,
      },
      { id: 42, visitDate: null },
    ]));

    const { result } = renderHook(() => useVisitNotes());
    expect(result.current.notes.map((note) => note.id)).toEqual(["valid"]);
  });

  it("normalizes corrupted storage before functional updates", () => {
    localStorage.setItem("jotrea_visit_notes", JSON.stringify([{ broken: true }]));
    const { result } = renderHook(() => useVisitNotes());

    act(() => {
      result.current.setNotes((current) => [
        ...current,
        {
          id: "new-note",
          visitDate: "2026-09-07",
          createdAt: "2026-09-07T12:00:00.000Z",
          updatedAt: "2026-09-07T12:00:00.000Z",
          includeInProviderSummary: false,
        },
      ]);
    });

    expect(result.current.notes.map((note) => note.id)).toEqual(["new-note"]);
  });
});