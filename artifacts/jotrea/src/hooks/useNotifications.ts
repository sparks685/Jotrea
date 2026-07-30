import { useState, useCallback, useEffect } from "react";
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

  // Re-check permission when user returns to the app (e.g. after granting in iOS Settings)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setPermission(getSafePermission());
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const requestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, requestPermission };
}
