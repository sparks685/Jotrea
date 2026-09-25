import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({
  useLocation: () => ["/weight", vi.fn()],
  Link: ({ children, ...rest }: React.PropsWithChildren<{ href?: string }>) => <a {...rest}>{children}</a>,
}));
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: (_target, tag: string) => ({ children, initial: _initial, animate: _animate,
    exit: _exit, variants: _variants, transition: _transition, custom: _custom,
    whileTap: _whileTap, whileHover: _whileHover, layout: _layout, ...rest }:
    React.PropsWithChildren<Record<string, unknown>>) => React.createElement(tag, rest, children) }),
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  LineChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Line: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, ReferenceLine: () => null,
}));

import WeightTracker from "@/pages/WeightTracker";

const original = [{ id: "first", date: "2026-01-01", weight: 190, notes: "Original" }];
function saved() {
  return JSON.parse(localStorage.getItem("jotrea_weights") ?? "[]") as typeof original;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("jotrea_user", JSON.stringify({ name: "Test", units: "lbs", subscription: "free" }));
  localStorage.setItem("jotrea_weights", JSON.stringify(original));
});

describe("rendered WeightTracker validation", () => {
  it("rejects 9999 without a storage write, preserves fields on confirmation, and allows edit or approval", () => {
    render(<WeightTracker />);
    fireEvent.click(screen.getByTestId("add-weight-btn"));
    fireEvent.change(screen.getByTestId("weight-value-input"), { target: { value: "9999" } });
    fireEvent.click(screen.getByTestId("save-weight-btn"));
    expect(screen.getByRole("alert")).toHaveTextContent("1500 lbs");
    expect(saved()).toEqual(original);

    fireEvent.change(screen.getByTestId("weight-value-input"), { target: { value: "280" } });
    fireEvent.change(screen.getByTestId("weight-date-input"), { target: { value: "2026-01-02" } });
    fireEvent.change(screen.getByTestId("weight-notes-input"), { target: { value: "After breakfast" } });
    fireEvent.click(screen.getByTestId("save-weight-btn"));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("190 lbs");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("280 lbs");
    expect(saved()).toEqual(original);
    fireEvent.click(screen.getByText("Edit weight"));
    expect(screen.getByTestId("weight-value-input")).toHaveValue(280);
    expect(screen.getByTestId("weight-date-input")).toHaveValue("2026-01-02");
    expect(screen.getByTestId("weight-notes-input")).toHaveValue("After breakfast");
    expect(saved()).toEqual(original);
    fireEvent.click(screen.getByTestId("save-weight-btn"));
    fireEvent.click(screen.getByText("Save anyway"));
    expect(saved()).toHaveLength(2);
    expect(saved()[1]).toMatchObject({ weight: 280, date: "2026-01-02", notes: "After breakfast" });
  });

  it("edits an entry and rejects invalid goal weights without updating the stored goal", () => {
    render(<WeightTracker />);
    fireEvent.click(screen.getByTestId("edit-weight-first"));
    expect(screen.getByTestId("weight-value-input")).toHaveValue(190);
    fireEvent.change(screen.getByTestId("weight-value-input"), { target: { value: "185" } });
    fireEvent.click(screen.getByTestId("save-weight-btn"));
    expect(saved()).toEqual([{ ...original[0], weight: 185 }]);

    const goal = screen.getByTestId("goal-weight-input");
    fireEvent.change(goal, { target: { value: "9999" } });
    fireEvent.blur(goal);
    expect(screen.getByRole("alert")).toHaveTextContent("1500 lbs");
    expect(JSON.parse(localStorage.getItem("jotrea_user") ?? "{}").goalWeight).toBeUndefined();
    fireEvent.change(goal, { target: { value: "150" } });
    fireEvent.blur(goal);
    expect(JSON.parse(localStorage.getItem("jotrea_user") ?? "{}").goalWeight).toBe(150);
  });

  it("defers an existing entry's large edit until explicitly confirmed", () => {
    localStorage.setItem("jotrea_weights", JSON.stringify([
      ...original, { id: "second", date: "2026-01-02", weight: 188, notes: "Before edit" },
    ]));
    render(<WeightTracker />);
    fireEvent.click(screen.getByTestId("edit-weight-second"));
    fireEvent.change(screen.getByTestId("weight-value-input"), { target: { value: "280" } });
    fireEvent.click(screen.getByTestId("save-weight-btn"));
    expect(saved()[1]).toMatchObject({ weight: 188, notes: "Before edit" });
    fireEvent.click(screen.getByText("Edit weight"));
    expect(saved()[1].weight).toBe(188);
    fireEvent.click(screen.getByTestId("save-weight-btn"));
    fireEvent.click(screen.getByText("Save anyway"));
    expect(saved()[1]).toMatchObject({ id: "second", weight: 280, notes: "Before edit" });
  });

  it("flags corrupt history while excluding it from chart and stats", () => {
    localStorage.setItem("jotrea_weights", JSON.stringify([...original, { id: "bad", date: "2026-01-02", weight: 9999 }]));
    render(<WeightTracker />);
    expect(screen.getByTestId("weight-entry-bad")).toHaveTextContent("Invalid weight");
    expect(screen.getByText("190 lbs")).toBeInTheDocument();
    expect(screen.getByText("Total Lost").parentElement).toHaveTextContent("—");
    fireEvent.click(screen.getByTestId("edit-weight-bad"));
    fireEvent.change(screen.getByTestId("weight-value-input"), { target: { value: "188" } });
    fireEvent.click(screen.getByTestId("save-weight-btn"));
    expect(saved().find(entry => entry.id === "bad")?.weight).toBe(188);
  });

  it("keeps a valid 1500 lb boundary entry valid across a kg display round trip", () => {
    localStorage.setItem("jotrea_weights", JSON.stringify([{ id: "limit", date: "2026-01-01", weight: 1500 }]));
    render(<WeightTracker />);
    fireEvent.click(screen.getByTestId("units-kg"));
    expect(screen.getByTestId("weight-entry-limit")).toHaveTextContent("680.4 kg");
    expect(screen.getByTestId("weight-entry-limit")).not.toHaveTextContent("Invalid weight");
    fireEvent.click(screen.getByTestId("units-lbs"));
    expect(screen.getByTestId("weight-entry-limit")).toHaveTextContent("1500 lbs");
  });
});