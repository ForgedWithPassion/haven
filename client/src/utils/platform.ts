export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream
  );
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

export function isPWA(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function supportsPushNotifications(): boolean {
  if (isIOS()) return false;
  return "serviceWorker" in navigator && "PushManager" in window;
}
