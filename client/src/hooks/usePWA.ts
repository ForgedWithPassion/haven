import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PWAStatus {
  needRefresh: boolean;
  offlineReady: boolean;
  isInstallable: boolean;
  isStandalone: boolean;
}

export interface PWAActions {
  install: () => Promise<boolean>;
  acceptUpdate: () => void;
  dismissUpdate: () => void;
  dismissOfflineReady: () => void;
}

export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log("Service Worker registered:", swUrl);
      if (registration) {
        setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000,
        );
      }
    },
    onRegisterError(error) {
      console.error("Service Worker registration error:", error);
    },
  });

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
    return outcome === "accepted";
  };

  const dismissUpdate = () => {
    setNeedRefresh(false);
  };

  const acceptUpdate = () => {
    updateServiceWorker(true);
  };

  const dismissOfflineReady = () => {
    setOfflineReady(false);
  };

  return {
    status: {
      needRefresh,
      offlineReady,
      isInstallable,
      isStandalone,
    } as PWAStatus,
    actions: {
      install,
      acceptUpdate,
      dismissUpdate,
      dismissOfflineReady,
    } as PWAActions,
  };
}
