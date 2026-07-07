import { useState, useCallback } from "react";

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
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
