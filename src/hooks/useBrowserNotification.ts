import { useCallback, useEffect, useState } from "react";

export function useBrowserNotification() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.log("Browser does not support notifications");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, []);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!("Notification" in window)) {
      return null;
    }

    if (Notification.permission !== "granted") {
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: "/app-icon-512.png",
        badge: "/app-icon-512.png",
        ...options,
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    } catch (error) {
      console.error("Error showing notification:", error);
      return null;
    }
  }, []);

  return {
    permission,
    requestPermission,
    showNotification,
    isSupported: "Notification" in window,
  };
}
