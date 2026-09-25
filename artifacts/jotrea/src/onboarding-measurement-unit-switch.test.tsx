import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

vi.mock("framer-motion", () => {
  const motion = new Proxy({}, {
    get: (_target, tag: string) => {
      const Component = ({ children, initial: _initial, animate: _animate,
        exit: _exit, variants: _variants, transition: _transition,
        custom: _custom, whileTap: _whileTap, layout: _layout, ...props }:
        React.PropsWithChildren<Record<string, unknown>>) =>
        React.createElement(tag, props, children);
      return Component;
    },
  });
  return {
    motion,
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  };
});

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/utils/notifications", () => ({
  isNotificationSupported: () => false,
  requestNotificationPermission: vi.fn(),
  scheduleAllNotifications: vi.fn(),
}));

import Onboarding from "@/pages/Onboarding";

function renderMeasurements() {
  const memory = memoryLocation({ path: "/onboarding" });
  render(
    <Router hook={memory.hook}>
      <Onboarding />
    </Router>
  );
  fireEvent.click(screen.getByText("Start Your Journey"));
  fireEvent.click(screen.getByText("I Understand"));
  fireEvent.click(screen.getByText("Female"));
  fireEvent.click(screen.getByText("Continue"));
  fireEvent.click(screen.getByText("Continue"));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("rendered onboarding measurement unit switch", () => {
  it("preserves 190 lb at 5 ft 6 in and its BMI through a metric round trip", () => {
    renderMeasurements();
    expect(screen.getByText(/BMI 30\.7/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Metric"));
    let selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(Number(selects[0].value)).toBeCloseTo(167.64, 10);
    expect(selects[1]).toHaveValue("86.2");
    expect(screen.getByText(/BMI 30\.7/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Imperial"));
    selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[0]).toHaveValue("5");
    expect(selects[1]).toHaveValue("6");
    expect(selects[2]).toHaveValue("190");
    expect(screen.getByText(/BMI 30\.7/)).toBeInTheDocument();
  });

  it("represents fractional inches for a metric height without round-trip drift", () => {
    renderMeasurements();
    fireEvent.click(screen.getByText("Metric"));
    let selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    fireEvent.change(selects[0], { target: { value: "165" } });

    fireEvent.click(screen.getByText("Imperial"));
    selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[0]).toHaveValue("5");
    expect(Number(selects[1].value)).toBeCloseTo(165 / 2.54 - 60, 10);

    fireEvent.click(screen.getByText("Metric"));
    selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[0]).toHaveValue("165");
  });
});

describe("rendered onboarding birthday validation", () => {
  it("blocks Feb 31 1990 and Dec 31 of this year, then clears the alert and advances for Jan 1 1990", () => {
      const memory = memoryLocation({ path: "/onboarding" });
      render(<Router hook={memory.hook}><Onboarding /></Router>);
      fireEvent.click(screen.getByText("Start Your Journey"));
      fireEvent.click(screen.getByText("I Understand"));
      fireEvent.click(screen.getByText("Female"));
      fireEvent.click(screen.getByText("Continue"));
      const changeBirthday = (index: number, value: string) =>
        fireEvent.change(screen.getAllByRole("combobox")[index], { target: { value } });
      changeBirthday(0, "2");
      changeBirthday(1, "31");
      expect(screen.getAllByRole("combobox").map(select => (select as HTMLSelectElement).value)).toEqual(["2", "31", "1990"]);
      expect(screen.getByText("Age:")).toHaveTextContent("—");
      fireEvent.click(screen.getByText("Continue"));
      expect(screen.getByRole("alert")).toHaveTextContent("valid birthday");
      expect(screen.getByText("When's your birthday?")).toBeInTheDocument();
      changeBirthday(0, "12");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      changeBirthday(1, "31");
      changeBirthday(2, String(new Date().getFullYear()));
      expect(screen.getByText("Age:")).toHaveTextContent("—");
      fireEvent.click(screen.getByText("Continue"));
      expect(screen.getByText("When's your birthday?")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("valid birthday");
      changeBirthday(0, "1");
      changeBirthday(1, "1");
      changeBirthday(2, "1990");
      expect(screen.getAllByRole("combobox").map(select => (select as HTMLSelectElement).value)).toEqual(["1", "1", "1990"]);
      expect(screen.getByText("Age:")).toHaveTextContent(String(new Date().getFullYear() - 1990));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      fireEvent.click(screen.getByText("Continue"));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("Your measurements")).toBeInTheDocument();
  });
});