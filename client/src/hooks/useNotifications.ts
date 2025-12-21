import { useState, useCallback } from "react";
import {
  supportsNotifications,
  getNotificationPermission,
  requestNotificationPermission,
  showNotification,
  isDocumentVisible,
  type NotificationOptions,
} from "../utils/notifications";

const STORAGE_KEY = "haven_notifications_enabled";

export interface UseNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  isEnabled: boolean;
  enable: () => Promise<boolean>;
  disable: () => void;
  notify: (options: NotificationOptions) => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => getNotificationPermission());

  const isSupported = supportsNotifications();

  const enable = useCallback(async () => {
    if (!isSupported) return false;

    if (permission !== "granted") {
      const granted = await requestNotificationPermission();
      setPermission(granted ? "granted" : "denied");
      if (!granted) return false;
    }

    localStorage.setItem(STORAGE_KEY, "true");
    setIsEnabled(true);
    return true;
  }, [isSupported, permission]);

  const disable = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "false");
    setIsEnabled(false);
  }, []);

  const notify = useCallback(
    (options: NotificationOptions) => {
      if (!isEnabled || !isSupported || permission !== "granted") return;
      if (isDocumentVisible()) return;

      showNotification(options);
    },
    [isEnabled, isSupported, permission],
  );

  return {
    isSupported,
    permission,
    isEnabled,
    enable,
    disable,
    notify,
  };
}
