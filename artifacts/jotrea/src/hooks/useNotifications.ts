import { useState, useCallback } from "react";
import { requestNotificationPermission } from "@/utils/notifications";

function getSafePermission(): NotificationPermission {
  try {
    if ("Notification" in window) return Notification.permission;
  } catch {
    // Notification API restricted in this context (e.g. cross-origin iframe)
  }
  return "default";
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(getSafePermission);

  const requestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, requestPermission };
}
