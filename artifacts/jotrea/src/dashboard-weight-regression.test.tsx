import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  LineChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  ReferenceLine: () => null,
}));

vi.mock("@/components/CountdownRing", () => ({
  CountdownRing: () => <div />,
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/utils/notifications", () => ({
  rescheduleAllNotifications: vi.fn(),
  cancelNotificationTag: vi.fn(),
}));

import Dashboard from "@/pages/Dashboard";
import WeightTracker from "@/pages/WeightTracker";

function seed(units: "lbs" | "kg", startingWeight: number) {
  localStorage.setItem("jotrea_user", JSON.stringify({
    name: "Test",
    units,
    subscription: "free",
  }));
  localStorage.setItem("jotrea_medication", JSON.stringify({
    id: "semaglutide-ozempic",
    genericName: "Semaglutide",
    brandName: "Ozempic",
    dose: 0.5,
    frequency: "weekly",
    startDate: "2026-09-01",
    active: true,
  }));
  localStorage.setItem("jotrea_weights", JSON.stringify([
    { id: "starting", date: "2026-09-20", weight: startingWeight },
  ]));
}

function quickWeightText() {
  return screen.getByTestId("add-weight-quick-btn").textContent ?? "";
}

describe("Dashboard weight card", () => {
  beforeEach(() => localStorage.clear());

  it("shows the latest same-day append and current-minus-previous delta immediately and after reload", () => {
    seed("lbs", 190);
    const firstRender = render(<Dashboard />);

    fireEvent.click(screen.getByTestId("add-weight-quick-btn"));
    fireEvent.change(screen.getByTestId("quick-weight-value"), { target: { value: "188" } });
    fireEvent.change(screen.getByTestId("quick-weight-date"), { target: { value: "2026-09-20" } });
    fireEvent.click(screen.getByTestId("submit-weight-btn"));

    expect(quickWeightText()).toContain("188 lbs");
    expect(quickWeightText()).toContain("-2.0");

    firstRender.unmount();
    render(<Dashboard />);
    expect(quickWeightText()).toContain("188 lbs");
    expect(quickWeightText()).toContain("-2.0");
  });

  it("renders a positive gain and respects kg display units", () => {
    seed("kg", 80);
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("add-weight-quick-btn"));
    fireEvent.change(screen.getByTestId("quick-weight-value"), { target: { value: "81.5" } });
    fireEvent.click(screen.getByTestId("submit-weight-btn"));

    expect(quickWeightText()).toContain("81.5 kg");
    expect(quickWeightText()).toContain("+1.5");
  });

  it("keeps the form open and explains an empty save", () => {
    seed("lbs", 190);
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("add-weight-quick-btn"));
    fireEvent.click(screen.getByTestId("submit-weight-btn"));

    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a valid weight.");
    expect(screen.getByTestId("quick-weight-value")).toHaveAttribute("aria-invalid", "true");
    expect(within(screen.getByRole("alert")).getByText("Please enter a valid weight.")).toBeVisible();
  });
});

describe("WeightTracker entry validation", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the entry form open and explains an invalid save", () => {
    seed("lbs", 190);
    render(<WeightTracker />);

    fireEvent.click(screen.getByTestId("add-weight-btn"));
    fireEvent.change(screen.getByTestId("weight-value-input"), { target: { value: "0" } });
    fireEvent.click(screen.getByTestId("save-weight-btn"));

    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a valid weight.");
    expect(screen.getByTestId("weight-value-input")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("save-weight-btn")).toBeInTheDocument();
  });
});
