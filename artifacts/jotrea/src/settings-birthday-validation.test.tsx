import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({
  useLocation: () => ["/settings", vi.fn()],
  Link: ({ children, ...rest }: React.PropsWithChildren<{ href?: string }>) => <a {...rest}>{children}</a>,
}));
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: (_target, tag: string) => ({ children, initial: _initial, animate: _animate,
    exit: _exit, variants: _variants, transition: _transition, custom: _custom,
    whileTap: _whileTap, whileHover: _whileHover, layout: _layout, ...rest }:
    React.PropsWithChildren<Record<string, unknown>>) => React.createElement(tag, rest, children) }),
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), initGA: vi.fn(), pageView: vi.fn() }));
vi.mock("@/utils/notifications", () => ({
  isNotificationSupported: () => false,
  getNotificationPermission: vi.fn().mockResolvedValue("default"),
  rescheduleAllNotifications: vi.fn(), cancelNotificationTag: vi.fn(),
  scheduleAllNotifications: vi.fn(), cancelAllNotifications: vi.fn(),
  getNextScheduledTime: vi.fn(() => null),
  requestNotificationPermission: vi.fn(async () => "default"),
  registerNotificationSW: vi.fn(),
}));
vi.mock("@/components/ChangeMedicationSheet", () => ({ ChangeMedicationSheet: () => null }));
vi.mock("@/utils/healthReportPdf", () => ({ exportHealthReportPdfs: vi.fn() }));

import Settings from "@/pages/Settings";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("jotrea_user", JSON.stringify({
    name: "Test", units: "lbs", subscription: "free", birthday: "2001-02-31",
  }));
});

describe("rendered Settings birthday repair", () => {
  it("identifies invalid legacy birthday, rejects another impossible date and saves correction", () => {
    render(<Settings />);
    fireEvent.click(screen.getByTestId("edit-birthday"));
    const editor = screen.getByTestId("birthday-editor");
    fireEvent.change(editor, { target: { value: "2026-02-31" } });
    fireEvent.click(screen.getByText("Save birthday"));
    expect(screen.getByRole("alert")).toHaveTextContent("valid birthday");
    expect(JSON.parse(localStorage.getItem("jotrea_user") ?? "{}").birthday).toBe("2001-02-31");
    fireEvent.change(editor, { target: { value: "2000-02-29" } });
    fireEvent.click(screen.getByText("Save birthday"));
    expect(screen.queryByTestId("birthday-editor")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("jotrea_user") ?? "{}").birthday).toBe("2000-02-29");
    expect(screen.queryByText("Update birthday")).not.toBeInTheDocument();
  });
});