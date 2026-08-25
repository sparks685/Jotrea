/**
 * Tests for cancelNotificationTag — verifies that the CANCEL_TAG message is
 * sent to the active service worker with the correct tag when a dose is logged.
 *
 * Dashboard.tsx calls `cancelNotificationTag(`jotrea-missed-dose-${logDate}`)` inside
 * handleLogDose, so we test the underlying utility here and confirm the wire format.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cancelAllNotifications,
  cancelNotificationTag,
  isNotificationSupported,
  requestNotificationPermission,
  rescheduleAllNotifications,
  scheduleAllNotifications,
} from "./notifications";
import type { MedicationData, UserData } from "@/types";

// ─── SW mock helpers ──────────────────────────────────────────────────────────

function makeMockSW() {
  return { postMessage: vi.fn() };
}

function installMockSW(sw: ReturnType<typeof makeMockSW> | null) {
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      getRegistration: vi.fn().mockResolvedValue(
        sw ? { active: sw, waiting: null, installing: null } : undefined
      ),
    },
    configurable: true,
    writable: true,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("cancelNotificationTag", () => {
  let mockSW: ReturnType<typeof makeMockSW>;

  beforeEach(() => {
    mockSW = makeMockSW();
    installMockSW(mockSW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends CANCEL_TAG to the service worker with the exact tag string", async () => {
    const tag = "jotrea-missed-dose-2026-07-30";
    await cancelNotificationTag(tag);

    expect(mockSW.postMessage).toHaveBeenCalledOnce();
    expect(mockSW.postMessage).toHaveBeenCalledWith({
      type: "CANCEL_TAG",
      payload: { tag },
    });
  });

  describe("scenario (a): dose logged before 9 PM — notification not yet shown", () => {
    it("cancels the pending missed-dose notification for today's date", async () => {
      // Simulates handleLogDose running at e.g. 14:30 (before the 21:00 missed-dose trigger)
      const logDate = "2026-07-30"; // today, afternoon
      const expectedTag = `jotrea-missed-dose-${logDate}`;

      await cancelNotificationTag(expectedTag);

      expect(mockSW.postMessage).toHaveBeenCalledWith({
        type: "CANCEL_TAG",
        payload: { tag: expectedTag },
      });
    });
  });

  describe("scenario (b): dose logged after 9 PM — notification may have already fired", () => {
    it("cancels the missed-dose notification for today's date even after 9 PM window has opened", async () => {
      // Simulates handleLogDose running at e.g. 21:45 (after the missed-dose notification fires)
      const logDate = "2026-07-30"; // today, late evening
      const expectedTag = `jotrea-missed-dose-${logDate}`;

      await cancelNotificationTag(expectedTag);

      expect(mockSW.postMessage).toHaveBeenCalledWith({
        type: "CANCEL_TAG",
        payload: { tag: expectedTag },
      });
    });
  });

  it("uses the logDate (not today's date) when a backdated dose is logged", async () => {
    // Edge case: user logs a dose for a past date; the tag must match that past date
    const backDate = "2026-07-23";
    const expectedTag = `jotrea-missed-dose-${backDate}`;

    await cancelNotificationTag(expectedTag);

    expect(mockSW.postMessage).toHaveBeenCalledWith({
      type: "CANCEL_TAG",
      payload: { tag: expectedTag },
    });
  });

  it("does nothing when no service worker is registered", async () => {
    // No active SW — postMessage should never be called; must not throw
    installMockSW(null);

    await expect(
      cancelNotificationTag("jotrea-missed-dose-2026-07-30")
    ).resolves.toBeUndefined();

    expect(mockSW.postMessage).not.toHaveBeenCalled();
  });
});

describe("Capacitor local notifications", () => {
  const localNotifications = {
    checkPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
    requestPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
    schedule: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    getPending: vi.fn().mockResolvedValue({
      notifications: [{ id: 17 }, { id: 23 }],
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "Capacitor", {
      configurable: true,
      value: {
        isNativePlatform: () => true,
        getPlatform: () => "ios",
        isPluginAvailable: (name: string) => name === "LocalNotifications",
        registerPlugin: () => localNotifications,
      },
    });
  });

  afterEach(() => {
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    localStorage.removeItem("jotrea_medication_cabinet");
  });

  it("uses native permission and capability APIs in an iOS shell", async () => {
    expect(isNotificationSupported()).toBe(true);
    await expect(requestNotificationPermission()).resolves.toBe("granted");
    expect(localNotifications.requestPermissions).toHaveBeenCalledOnce();
  });

  it("schedules real calendar notifications through the native plugin", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T08:00:00"));
    const medication = {
      brandName: "Zepbound",
      startDate: "2026-07-29",
      frequency: "weekly",
    } as MedicationData;
    const user = { notificationTime: "09:00" } as UserData;

    await scheduleAllNotifications(medication, [], user);

    expect(localNotifications.schedule).toHaveBeenCalledOnce();
    const scheduled = localNotifications.schedule.mock.calls[0][0].notifications;
    expect(scheduled[0]).toMatchObject({
      title: "💉 Dose day",
      schedule: { allowWhileIdle: true },
      extra: { path: "/", tag: "jotrea-dose-due-2026-07-29" },
    });
    expect(scheduled[0].schedule.at).toEqual(new Date("2026-07-29T09:00:00"));
    vi.useRealTimers();
  });

  it("cancels native pending notifications without a service worker", async () => {
    await cancelNotificationTag("jotrea-missed-dose-2026-07-30");
    expect(localNotifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: expect.any(Number) }],
    });

    await cancelAllNotifications();
    expect(localNotifications.cancel).toHaveBeenLastCalledWith({
      notifications: [{ id: 17 }, { id: 23 }],
    });
  });

  it("schedules each active Cabinet reminder using medication-scoped doses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T08:00:00"));
    localStorage.setItem(
      "jotrea_medication_cabinet",
      JSON.stringify([
        {
          cabinetId: "cabinet-metformin",
          id: "metformin",
          genericName: "metformin",
          brandName: "Metformin",
          dose: 500,
          frequency: "daily",
          startDate: "2026-07-29",
          active: true,
          reminderTimes: ["10:15", "20:30"],
          createdAt: "2026-07-01T00:00:00.000Z",
        },
        {
          cabinetId: "inactive",
          id: "inactive-med",
          brandName: "Inactive",
          dose: 1,
          frequency: "daily",
          startDate: "2026-07-29",
          active: false,
          reminderTimes: ["10:00"],
        },
      ])
    );
    const medication = {
      brandName: "Zepbound",
      startDate: "2026-07-29",
      frequency: "weekly",
    } as MedicationData;
    const user = { notificationTime: "09:00" } as UserData;
    // A dose for another medication must not make Metformin's daily schedule
    // advance to tomorrow.
    const doses = [
      {
        id: "other-med-dose",
        medicationId: "another-medication",
        date: "2026-07-29",
        time: "08:00",
        doseAmount: 1,
        site: "",
        notes: "",
        taken: true,
      },
    ] as unknown as import("@/types").DoseEntry[];

    await scheduleAllNotifications(medication, doses, user);

    const scheduled = localNotifications.schedule.mock.calls[0][0].notifications;
    const cabinet = scheduled.filter((item: { extra: { tag: string } }) =>
      item.extra.tag.startsWith("jotrea-cabinet-dose-cabinet-metformin-")
    );
    expect(cabinet).toHaveLength(2);
    expect(cabinet.map((item: { schedule: { at: Date } }) => item.schedule.at)).toEqual([
      new Date("2026-07-29T10:15:00"),
      new Date("2026-07-29T20:30:00"),
    ]);
    expect(scheduled.some((item: { extra: { tag: string } }) => item.extra.tag.includes("inactive"))).toBe(false);
    vi.useRealTimers();
  });

  it("ignores malformed Cabinet storage without preventing primary reminders", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T08:00:00"));
    localStorage.setItem("jotrea_medication_cabinet", "{not json");
    const medication = {
      brandName: "Zepbound",
      startDate: "2026-07-29",
      frequency: "weekly",
    } as MedicationData;
    await scheduleAllNotifications(medication, [], { notificationTime: "09:00" } as UserData);
    expect(localNotifications.schedule).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("advances daily and twice-daily Cabinet reminders from their own logged doses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T08:00:00"));
    const cabinet = [
      {
        cabinetId: "daily-tracker", id: "same-brand", genericName: "daily", brandName: "Daily Med",
        dose: 1, frequency: "daily" as const, startDate: "2026-07-29", active: true,
        reminderTimes: ["10:00"], createdAt: "2026-07-01T00:00:00.000Z",
      },
      {
        cabinetId: "twice-tracker", id: "same-brand", genericName: "twice", brandName: "Twice Med",
        dose: 2, frequency: "twice-daily" as const, startDate: "2026-07-29", active: true,
        reminderTimes: ["11:00"], createdAt: "2026-07-01T00:00:00.000Z",
      },
    ];
    const doses = [
      { id: "daily", medicationId: "daily-tracker", date: "2026-07-29", time: "07:00", doseAmount: 1, site: "", notes: "", taken: true },
      { id: "twice-a", medicationId: "twice-tracker", date: "2026-07-29", time: "07:00", doseAmount: 2, site: "", notes: "", taken: true },
      { id: "twice-b", medicationId: "twice-tracker", date: "2026-07-29", time: "08:00", doseAmount: 2, site: "", notes: "", taken: true },
    ] as import("@/types").DoseEntry[];
    const primary = { brandName: "Primary", startDate: "2026-07-29", frequency: "weekly" } as MedicationData;

    await scheduleAllNotifications(primary, [], { notificationTime: "09:00" } as UserData, {
      allDoses: doses,
      cabinetMedications: cabinet,
    });

    const tags = localNotifications.schedule.mock.calls[0][0].notifications.map(
      (item: { extra: { tag: string } }) => item.extra.tag
    );
    expect(tags).toContain("jotrea-cabinet-dose-daily-tracker-2026-07-30-10:00");
    expect(tags).toContain("jotrea-cabinet-dose-twice-tracker-2026-07-30-11:00");
    vi.useRealTimers();
  });

  it("uses post-mutation Cabinet input when rebuilding reminders immediately", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T08:00:00"));
    const primary = { brandName: "Primary", startDate: "2026-07-29", frequency: "weekly" } as MedicationData;
    const base = {
      cabinetId: "editable", id: "editable-med", genericName: "editable", brandName: "Editable",
      dose: 1, frequency: "weekly" as const, startDate: "2026-07-29", active: true,
      createdAt: "2026-07-01T00:00:00.000Z",
    };
    await scheduleAllNotifications(primary, [], { notificationTime: "09:00" } as UserData, {
      cabinetMedications: [{ ...base, reminderTimes: ["10:00"] }],
    });
    await rescheduleAllNotifications(primary, [], { notificationTime: "09:00" } as UserData, {
      cabinetMedications: [{ ...base, reminderTimes: ["15:00"] }],
    });

    expect(localNotifications.cancel).toHaveBeenCalled();
    const rebuilt = localNotifications.schedule.mock.calls[1][0].notifications.map(
      (item: { extra: { tag: string } }) => item.extra.tag
    );
    expect(rebuilt).toContain("jotrea-cabinet-dose-editable-2026-07-29-15:00");
    expect(rebuilt).not.toContain("jotrea-cabinet-dose-editable-2026-07-29-10:00");
    vi.useRealTimers();
  });
});
