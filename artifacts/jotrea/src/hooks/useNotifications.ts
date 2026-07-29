import { useState, useCallback } from "react";

function getSafePermission(): NotificationPermission {
  try {
    if ("Notification" in window) return Notification.permission;
  } catch {
    // Notification API restricted in this context (e.g., cross-origin iframe)
  }
  return "denied";
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(getSafePermission);

  const requestPermission = useCallback(async () => {
    try {
      if (!("Notification" in window)) return "denied";
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return "denied" as NotificationPermission;
    }
  }, []);

  const scheduleReminder = useCallback(
    (title: string, body: string, delayMs: number) => {
      if (permission !== "granted") return;
      setTimeout(() => {
        new Notification(title, {
          body,
          icon: "/icon-192x192.png",
        });
      }, delayMs);
    },
    [permission]
  );

  return { permission, requestPermission, scheduleReminder };
}
