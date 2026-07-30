/**
 * Jotrea notification utilities.
 * Handles SW registration, permission requests, notification scheduling,
 * cancellation, and rescheduling.
 */
import type { MedicationData, DoseEntry, UserData } from "@/types";
import { getNextDoseDate } from "@/utils/dates";
import { format, isSunday, nextSunday, addDays } from "date-fns";

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

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    if (!("Notification" in window)) return "denied";
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
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

function buildSchedule(
  medication: MedicationData,
  doses: DoseEntry[],
  user: UserData
): ScheduledNotif[] {
  const notifs: ScheduledNotif[] = [];
  const now = Date.now();
  const { h, m } = parseHourMin(user.notificationTime);

  // ── Dose reminders ────────────────────────────────────────────────────────
  const nextDose = getNextDoseDate(medication.startDate, medication.frequency, doses);
  if (nextDose) {
    const dateStr = format(nextDose, "yyyy-MM-dd");
    const alreadyLogged = doses.some((d) => d.date === dateStr && d.taken);

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
  user: UserData
): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const sw = await getActiveSW();
  if (!sw) return;
  for (const notif of buildSchedule(medication, doses, user)) {
    sw.postMessage({ type: "SCHEDULE", payload: notif });
  }
}

export async function cancelNotificationTag(tag: string): Promise<void> {
  const sw = await getActiveSW();
  sw?.postMessage({ type: "CANCEL_TAG", payload: { tag } });
}

export async function cancelAllNotifications(): Promise<void> {
  const sw = await getActiveSW();
  sw?.postMessage({ type: "CANCEL_ALL", payload: {} });
}

export async function rescheduleAllNotifications(
  medication: MedicationData,
  doses: DoseEntry[],
  user: UserData
): Promise<void> {
  const sw = await getActiveSW();
  if (!sw) return;
  // Cancel first, then reschedule after a small gap
  sw.postMessage({ type: "CANCEL_ALL", payload: {} });
  await new Promise<void>((r) => setTimeout(r, 30));
  await scheduleAllNotifications(medication, doses, user);
}

/** Returns the soonest upcoming scheduled notification time, for display in Settings. */
export function getNextScheduledTime(
  medication: MedicationData,
  doses: DoseEntry[],
  user: UserData
): Date | null {
  if (!("Notification" in window) || Notification.permission !== "granted") return null;
  const schedule = buildSchedule(medication, doses, user);
  if (!schedule.length) return null;
  const soonest = schedule.reduce((a, b) => (a.delayMs < b.delayMs ? a : b));
  return new Date(Date.now() + soonest.delayMs);
}
