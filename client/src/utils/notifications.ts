import { isIOS } from "./platform";

export interface NotificationData {
  type: "dm" | "room";
  userId?: string;
  roomId?: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  tag?: string;
  data?: NotificationData;
}

export function supportsNotifications(): boolean {
  if (isIOS()) return false;
  return typeof Notification !== "undefined";
}

export function getNotificationPermission():
  | NotificationPermission
  | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showNotification(
  options: NotificationOptions,
): Notification | null {
  if (typeof Notification === "undefined") return null;
  if (Notification.permission !== "granted") return null;

  return new Notification(options.title, {
    body: options.body,
    tag: options.tag,
    data: options.data,
  });
}

export function isDocumentVisible(): boolean {
  return document.visibilityState === "visible";
}
