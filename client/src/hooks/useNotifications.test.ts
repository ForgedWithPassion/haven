import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotifications } from "./useNotifications";
import * as notifications from "../utils/notifications";

vi.mock("../utils/notifications", () => ({
  supportsNotifications: vi.fn(),
  getNotificationPermission: vi.fn(),
  requestNotificationPermission: vi.fn(),
  showNotification: vi.fn(),
  isDocumentVisible: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("useNotifications hook", () => {
  const STORAGE_KEY = "haven_notifications_enabled";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    vi.mocked(notifications.supportsNotifications).mockReturnValue(true);
    vi.mocked(notifications.getNotificationPermission).mockReturnValue(
      "default",
    );
    vi.mocked(notifications.isDocumentVisible).mockReturnValue(false);
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("initial state", () => {
    it("returns isSupported based on supportsNotifications", () => {
      vi.mocked(notifications.supportsNotifications).mockReturnValue(true);
      const { result } = renderHook(() => useNotifications());
      expect(result.current.isSupported).toBe(true);
    });

    it("returns isSupported false when not supported", () => {
      vi.mocked(notifications.supportsNotifications).mockReturnValue(false);
      const { result } = renderHook(() => useNotifications());
      expect(result.current.isSupported).toBe(false);
    });

    it("returns current permission status", () => {
      vi.mocked(notifications.getNotificationPermission).mockReturnValue(
        "granted",
      );
      const { result } = renderHook(() => useNotifications());
      expect(result.current.permission).toBe("granted");
    });

    it("loads isEnabled from localStorage", () => {
      localStorageMock.setItem(STORAGE_KEY, "true");
      const { result } = renderHook(() => useNotifications());
      expect(result.current.isEnabled).toBe(true);
    });

    it("defaults isEnabled to false when not in localStorage", () => {
      const { result } = renderHook(() => useNotifications());
      expect(result.current.isEnabled).toBe(false);
    });
  });

  describe("enable", () => {
    it("requests permission and enables notifications when granted", async () => {
      vi.mocked(notifications.requestNotificationPermission).mockResolvedValue(
        true,
      );
      vi.mocked(notifications.getNotificationPermission).mockReturnValue(
        "default",
      );

      const { result } = renderHook(() => useNotifications());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.enable();
      });

      expect(success).toBe(true);
      expect(result.current.isEnabled).toBe(true);
      expect(localStorageMock.getItem(STORAGE_KEY)).toBe("true");
    });

    it("returns false when permission is denied", async () => {
      vi.mocked(notifications.requestNotificationPermission).mockResolvedValue(
        false,
      );

      const { result } = renderHook(() => useNotifications());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.enable();
      });

      expect(success).toBe(false);
      expect(result.current.isEnabled).toBe(false);
    });

    it("returns false when notifications not supported", async () => {
      vi.mocked(notifications.supportsNotifications).mockReturnValue(false);

      const { result } = renderHook(() => useNotifications());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.enable();
      });

      expect(success).toBe(false);
    });

    it("does not request permission if already granted", async () => {
      vi.mocked(notifications.getNotificationPermission).mockReturnValue(
        "granted",
      );
      vi.mocked(notifications.requestNotificationPermission).mockResolvedValue(
        true,
      );

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.enable();
      });

      expect(
        notifications.requestNotificationPermission,
      ).not.toHaveBeenCalled();
      expect(result.current.isEnabled).toBe(true);
    });
  });

  describe("disable", () => {
    it("disables notifications and updates localStorage", () => {
      localStorageMock.setItem(STORAGE_KEY, "true");
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.disable();
      });

      expect(result.current.isEnabled).toBe(false);
      expect(localStorageMock.getItem(STORAGE_KEY)).toBe("false");
    });
  });

  describe("notify", () => {
    it("shows notification when enabled and tab is hidden", () => {
      localStorageMock.setItem(STORAGE_KEY, "true");
      vi.mocked(notifications.getNotificationPermission).mockReturnValue(
        "granted",
      );
      vi.mocked(notifications.isDocumentVisible).mockReturnValue(false);

      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.notify({ title: "Test", body: "Hello" });
      });

      expect(notifications.showNotification).toHaveBeenCalledWith({
        title: "Test",
        body: "Hello",
      });
    });

    it("does not show notification when tab is visible", () => {
      localStorageMock.setItem(STORAGE_KEY, "true");
      vi.mocked(notifications.getNotificationPermission).mockReturnValue(
        "granted",
      );
      vi.mocked(notifications.isDocumentVisible).mockReturnValue(true);

      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.notify({ title: "Test", body: "Hello" });
      });

      expect(notifications.showNotification).not.toHaveBeenCalled();
    });

    it("does not show notification when disabled", () => {
      localStorageMock.setItem(STORAGE_KEY, "false");
      vi.mocked(notifications.getNotificationPermission).mockReturnValue(
        "granted",
      );
      vi.mocked(notifications.isDocumentVisible).mockReturnValue(false);

      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.notify({ title: "Test", body: "Hello" });
      });

      expect(notifications.showNotification).not.toHaveBeenCalled();
    });

    it("does not show notification when permission not granted", () => {
      localStorageMock.setItem(STORAGE_KEY, "true");
      vi.mocked(notifications.getNotificationPermission).mockReturnValue(
        "denied",
      );
      vi.mocked(notifications.isDocumentVisible).mockReturnValue(false);

      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.notify({ title: "Test", body: "Hello" });
      });

      expect(notifications.showNotification).not.toHaveBeenCalled();
    });

    it("does not show notification when not supported", () => {
      localStorageMock.setItem(STORAGE_KEY, "true");
      vi.mocked(notifications.supportsNotifications).mockReturnValue(false);
      vi.mocked(notifications.isDocumentVisible).mockReturnValue(false);

      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.notify({ title: "Test", body: "Hello" });
      });

      expect(notifications.showNotification).not.toHaveBeenCalled();
    });
  });
});
