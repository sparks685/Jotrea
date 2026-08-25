/**
 * Jotrea notification utilities.
 * Handles SW registration, permission requests, notification scheduling,
 * cancellation, and rescheduling.
 */
import type { CabinetMedication, MedicationData, DoseEntry, UserData } from "@/types";
import { getNextDoseDate } from "@/utils/dates";
import { format, isSunday, nextSunday, addDays } from "date-fns";
import { getNativePlugin, isNativeCapacitor } from "./capacitor";
import { dosesForMedication, getMedicationTrackingId } from "./medicationDoses";

interface NativeNotification {
  id: number;
  title: string;
  body: string;
  schedule: { at: Date; allowWhileIdle: boolean };
  extra: { path: string; tag: string };
}

interface LocalNotificationsPlugin {
  checkPermissions: () => Promise<{ display: string }>;
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (options: { notifications: NativeNotification[] }) => Promise<unknown>;
  cancel: (options: { notifications: { id: number }[] }) => Promise<unknown>;
  getPending: () => Promise<{ notifications: { id: number; extra?: { tag?: string } }[] }>;
  addListener?: (
    eventName: "localNotificationActionPerformed",
    listener: (event: { notification?: { extra?: { path?: string } } }) => void
  ) => Promise<{ remove: () => Promise<void> }>;
}

function nativeNotifications(): LocalNotificationsPlugin | null {
  return getNativePlugin<LocalNotificationsPlugin>("LocalNotifications");
}

function notificationId(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (Math.imul(hash, 31) + tag.charCodeAt(i)) | 0;
  return (hash & 0x7fffffff) || 1;
}

function normalizePermission(permission: string): NotificationPermission {
  if (permission === "granted" || permission === "denied") return permission;
  return "default";
}

// ─── Service Worker ───────────────────────────────────────────────────────────

export async function registerNotificationSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    const scope = import.meta.env.BASE_URL;
    const reg = await navigator.serviceWorker.register(swUrl, { scope });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn("[Jotrea] SW registration failed:", err);
    return null;
  }
}

async function getActiveSW(): Promise<ServiceWorker | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.active ?? reg?.waiting ?? reg?.installing ?? null;
  } catch {
    return null;
  }
}

// ─── Capability detection ─────────────────────────────────────────────────────

/**
 * Whether this environment can actually deliver web notifications.
 * iOS WKWebView (Capacitor wrapper) exposes neither the Notification API nor
 * a usable service-worker notification pipeline — in that case notification
 * UI should be hidden entirely rather than presenting dead controls.
 */
export function isNotificationSupported(): boolean {
  if (isNativeCapacitor()) return nativeNotifications() !== null;
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    const native = nativeNotifications();
    if (native) return normalizePermission((await native.requestPermissions()).display);
    if (!("Notification" in window)) return "denied";
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  try {
    const native = nativeNotifications();
    if (native) return normalizePermission((await native.checkPermissions()).display);
    if (typeof window !== "undefined" && "Notification" in window) return Notification.permission;
  } catch {
    // Treat an inaccessible permission API as unavailable.
  }
  return "denied";
}

// ─── Schedule Calculation ─────────────────────────────────────────────────────

interface ScheduledNotif {
  tag: string;
  title: string;
  body: string;
  delayMs: number;
  data: { path: string };
}

function parseHourMin(timeStr?: string): { h: number; m: number } {
  const [h, m] = (timeStr ?? "09:00").split(":").map(Number);
  return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m };
}

function isReminderTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const { h, m } = parseHourMin(value);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function isCabinetMedication(value: unknown): value is CabinetMedication {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const medication = value as Record<string, unknown>;
  return (
    typeof medication.cabinetId === "string" &&
    medication.cabinetId.length > 0 &&
    typeof medication.id === "string" &&
    medication.id.length > 0 &&
    typeof medication.brandName === "string" &&
    medication.brandName.length > 0 &&
    typeof medication.dose === "number" &&
    Number.isFinite(medication.dose) &&
    typeof medication.startDate === "string" &&
    ["weekly", "daily", "twice-daily"].includes(String(medication.frequency)) &&
    medication.active === true &&
    Array.isArray(medication.reminderTimes)
  );
}

function getActiveCabinetMedications(): CabinetMedication[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("jotrea_medication_cabinet");
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCabinetMedication).map((medication) => ({
      ...medication,
      reminderTimes: medication.reminderTimes.filter(isReminderTime),
    }));
  } catch {
    return [];
  }
}

function buildCabinetSchedule(
  now: number,
  doses: DoseEntry[],
  user: UserData,
  cabinetMedications?: CabinetMedication[]
): ScheduledNotif[] {
  const notifications: ScheduledNotif[] = [];
  for (const medication of cabinetMedications ?? getActiveCabinetMedications()) {
    const trackingId = getMedicationTrackingId(medication);
    const medicationDoses = dosesForMedication(doses, medication, user.legacyDoseMedicationId);
    let nextDose: Date;
    try {
      nextDose = getNextDoseDate(medication.startDate, medication.frequency, medicationDoses);
    } catch {
      continue;
    }
    if (Number.isNaN(nextDose.getTime())) continue;
    const dateStr = format(nextDose, "yyyy-MM-dd");
    for (const time of medication.reminderTimes) {
      const { h, m } = parseHourMin(time);
      const reminderAt = new Date(nextDose);
      reminderAt.setHours(h, m, 0, 0);
      const delayMs = reminderAt.getTime() - now;
      if (delayMs <= 0 || delayMs > 14 * 24 * 60 * 60 * 1000) continue;
      notifications.push({
        tag: `jotrea-cabinet-dose-${trackingId}-${dateStr}-${time}`,
        title: "💉 Medication reminder",
        body: `Your ${medication.brandName} dose is scheduled now.`,
        delayMs,
        data: { path: "/" },
      });
    }
  }
  return notifications;
}

function buildSchedule(
  medication: MedicationData,
  primaryMedicationDoses: DoseEntry[],
  user: UserData,
  allDoses: DoseEntry[] = primaryMedicationDoses,
  cabinetMedications?: CabinetMedication[]
): ScheduledNotif[] {
  const notifs: ScheduledNotif[] = [];
  const now = Date.now();
  const { h, m } = parseHourMin(user.notificationTime);

  // ── Dose reminders ────────────────────────────────────────────────────────
  const nextDose = getNextDoseDate(medication.startDate, medication.frequency, primaryMedicationDoses);
  if (nextDose) {
    const dateStr = format(nextDose, "yyyy-MM-dd");
    const alreadyLogged = primaryMedicationDoses.some((d) => d.date === dateStr && d.taken);

    // Dose-due: fires at the user's chosen reminder time on dose day
    const dueTime = new Date(nextDose);
    dueTime.setHours(h, m, 0, 0);
    const dueDelay = dueTime.getTime() - now;
    if (dueDelay > 0 && dueDelay <= 14 * 24 * 60 * 60 * 1000) {
      notifs.push({
        tag: `jotrea-dose-due-${dateStr}`,
        title: "💉 Dose day",
        body: `Your ${medication.brandName} dose is scheduled for today.`,
        delayMs: dueDelay,
        data: { path: "/" },
      });
    }

    // Missed-dose: fires at 9 PM on dose day if not yet logged
    if (!alreadyLogged) {
      const missedTime = new Date(nextDose);
      missedTime.setHours(21, 0, 0, 0);
      const missedDelay = missedTime.getTime() - now;
      if (missedDelay > 0 && missedDelay <= 14 * 24 * 60 * 60 * 1000) {
        notifs.push({
          tag: `jotrea-missed-dose-${dateStr}`,
          title: "⏰ Did you take your dose today?",
          body: `Don't forget to log your ${medication.brandName}. Tap to log now.`,
          delayMs: missedDelay,
          data: { path: "/" },
        });
      }
    }
  }

  // ── Additional Medication Cabinet reminders ───────────────────────────────
  // Cabinet reminders are independent of the primary medication reminder and
  // use their own prescribed reminderTimes.
  notifs.push(...buildCabinetSchedule(now, allDoses, user, cabinetMedications));

  // ── Weekly weigh-in — next Sunday at 8 AM ─────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weighDay = isSunday(today) ? addDays(today, 7) : nextSunday(today);
  weighDay.setHours(8, 0, 0, 0);
  const weighDelay = weighDay.getTime() - now;
  if (weighDelay > 0 && weighDelay <= 14 * 24 * 60 * 60 * 1000) {
    notifs.push({
      tag: `jotrea-weighin-${format(weighDay, "yyyy-MM-dd")}`,
      title: "⚖️ Weekly weigh-in",
      body: "Log your weight to track your GLP-1 progress.",
      delayMs: weighDelay,
      data: { path: "/weight" },
    });
  }

  return notifs;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scheduleAllNotifications(
  medication: MedicationData,
  doses: DoseEntry[],
  user: UserData,
  input?: { allDoses?: DoseEntry[]; cabinetMedications?: CabinetMedication[] }
): Promise<void> {
  const native = nativeNotifications();
  if (native) {
    if (normalizePermission((await native.checkPermissions()).display) !== "granted") return;
    const notifications = buildSchedule(
      medication, doses, user, input?.allDoses, input?.cabinetMedications
    ).map((item) => ({
      id: notificationId(item.tag),
      title: item.title,
      body: item.body,
      schedule: { at: new Date(Date.now() + item.delayMs), allowWhileIdle: true },
      extra: { ...item.data, tag: item.tag },
    }));
    if (notifications.length) await native.schedule({ notifications });
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const sw = await getActiveSW();
  if (!sw) return;
  for (const notif of buildSchedule(medication, doses, user, input?.allDoses, input?.cabinetMedications)) {
    sw.postMessage({ type: "SCHEDULE", payload: notif });
  }
}

let nativeRoutingRegistered = false;

/** Routes taps on native reminders to the same in-app path used by web notifications. */
export function registerNativeNotificationRouting(): void {
  if (nativeRoutingRegistered) return;
  const native = nativeNotifications();
  if (!native?.addListener) return;
  nativeRoutingRegistered = true;
  void native
    .addListener("localNotificationActionPerformed", ({ notification }) => {
      const path = notification?.extra?.path;
      if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) {
        window.location.assign(path);
      }
    })
    .catch((error) => {
      nativeRoutingRegistered = false;
      console.warn("[Jotrea] Could not register notification routing:", error);
    });
}

export async function cancelNotificationTag(tag: string): Promise<void> {
  const native = nativeNotifications();
  if (native) {
    await native.cancel({ notifications: [{ id: notificationId(tag) }] });
    return;
  }
  const sw = await getActiveSW();
  sw?.postMessage({ type: "CANCEL_TAG", payload: { tag } });
}

export async function cancelAllNotifications(): Promise<void> {
  const native = nativeNotifications();
  if (native) {
    const pending = await native.getPending();
    if (pending.notifications.length) {
      await native.cancel({
        notifications: pending.notifications.map(({ id }) => ({ id })),
      });
    }
    return;
  }
  const sw = await getActiveSW();
  sw?.postMessage({ type: "CANCEL_ALL", payload: {} });
}

export async function rescheduleAllNotifications(
  medication: MedicationData,
  doses: DoseEntry[],
  user: UserData,
  input?: { allDoses?: DoseEntry[]; cabinetMedications?: CabinetMedication[] }
): Promise<void> {
  if (nativeNotifications()) {
    await cancelAllNotifications();
    await scheduleAllNotifications(medication, doses, user, input);
    return;
  }
  const sw = await getActiveSW();
  if (!sw) return;
  // Cancel first, then reschedule after a small gap
  sw.postMessage({ type: "CANCEL_ALL", payload: {} });
  await new Promise<void>((r) => setTimeout(r, 30));
  await scheduleAllNotifications(medication, doses, user, input);
}

/** Returns the soonest upcoming scheduled notification time, for display in Settings. */
export function getNextScheduledTime(
  medication: MedicationData,
  doses: DoseEntry[],
  user: UserData
): Date | null {
  if (!isNativeCapacitor() && (!("Notification" in window) || Notification.permission !== "granted")) return null;
  const schedule = buildSchedule(medication, doses, user);
  if (!schedule.length) return null;
  const soonest = schedule.reduce((a, b) => (a.delayMs < b.delayMs ? a : b));
  return new Date(Date.now() + soonest.delayMs);
}
