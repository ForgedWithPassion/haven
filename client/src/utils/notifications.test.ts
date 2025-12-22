import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  supportsNotifications,
  getNotificationPermission,
  requestNotificationPermission,
  showNotification,
  isDocumentVisible,
} from "./notifications";

describe("notifications utility", () => {
  const originalNotification = globalThis.Notification;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.Notification = originalNotification;
  });

  describe("supportsNotifications", () => {
    it("returns true when Notification API is available", () => {
      globalThis.Notification = vi.fn() as unknown as typeof Notification;
      expect(supportsNotifications()).toBe(true);
    });

    it("returns false when Notification API is not available", () => {
      // @ts-expect-error - testing undefined case
      globalThis.Notification = undefined;
      expect(supportsNotifications()).toBe(false);
    });

    it("returns false on iOS devices", () => {
      globalThis.Notification = vi.fn() as unknown as typeof Notification;
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        configurable: true,
      });
      expect(supportsNotifications()).toBe(false);
      Object.defineProperty(navigator, "userAgent", {
        value: originalUserAgent,
        configurable: true,
      });
    });
  });

  describe("getNotificationPermission", () => {
    it("returns 'unsupported' when Notification API is not available", () => {
      // @ts-expect-error - testing undefined case
      globalThis.Notification = undefined;
      expect(getNotificationPermission()).toBe("unsupported");
    });

    it("returns 'granted' when permission is granted", () => {
      globalThis.Notification = {
        permission: "granted",
      } as unknown as typeof Notification;
      expect(getNotificationPermission()).toBe("granted");
    });

    it("returns 'denied' when permission is denied", () => {
      globalThis.Notification = {
        permission: "denied",
      } as unknown as typeof Notification;
      expect(getNotificationPermission()).toBe("denied");
    });

    it("returns 'default' when permission not yet requested", () => {
      globalThis.Notification = {
        permission: "default",
      } as unknown as typeof Notification;
      expect(getNotificationPermission()).toBe("default");
    });
  });

  describe("requestNotificationPermission", () => {
    it("returns true when permission is granted", async () => {
      globalThis.Notification = {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("granted"),
      } as unknown as typeof Notification;
      const result = await requestNotificationPermission();
      expect(result).toBe(true);
    });

    it("returns false when permission is denied", async () => {
      globalThis.Notification = {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("denied"),
      } as unknown as typeof Notification;
      const result = await requestNotificationPermission();
      expect(result).toBe(false);
    });

    it("returns false when Notification API is not available", async () => {
      // @ts-expect-error - testing undefined case
      globalThis.Notification = undefined;
      const result = await requestNotificationPermission();
      expect(result).toBe(false);
    });

    it("returns true if already granted without requesting", async () => {
      globalThis.Notification = {
        permission: "granted",
        requestPermission: vi.fn(),
      } as unknown as typeof Notification;
      const result = await requestNotificationPermission();
      expect(result).toBe(true);
      expect(Notification.requestPermission).not.toHaveBeenCalled();
    });
  });

  describe("showNotification", () => {
    it("creates a notification with title and body", () => {
      const mockNotification = vi.fn();
      globalThis.Notification =
        mockNotification as unknown as typeof Notification;
      Object.defineProperty(globalThis.Notification, "permission", {
        value: "granted",
        configurable: true,
      });

      showNotification({ title: "Test", body: "Hello" });

      expect(mockNotification).toHaveBeenCalledWith("Test", {
        body: "Hello",
        tag: undefined,
        data: undefined,
      });
    });

    it("includes tag for notification grouping", () => {
      const mockNotification = vi.fn();
      globalThis.Notification =
        mockNotification as unknown as typeof Notification;
      Object.defineProperty(globalThis.Notification, "permission", {
        value: "granted",
        configurable: true,
      });

      showNotification({ title: "Test", body: "Hello", tag: "dm-user1" });

      expect(mockNotification).toHaveBeenCalledWith("Test", {
        body: "Hello",
        tag: "dm-user1",
        data: undefined,
      });
    });

    it("includes data for click handling", () => {
      const mockNotification = vi.fn();
      globalThis.Notification =
        mockNotification as unknown as typeof Notification;
      Object.defineProperty(globalThis.Notification, "permission", {
        value: "granted",
        configurable: true,
      });

      const data = { type: "dm" as const, userId: "user1" };
      showNotification({ title: "Test", body: "Hello", data });

      expect(mockNotification).toHaveBeenCalledWith("Test", {
        body: "Hello",
        tag: undefined,
        data,
      });
    });

    it("returns null when permission is not granted", () => {
      globalThis.Notification = {
        permission: "denied",
      } as unknown as typeof Notification;

      const result = showNotification({ title: "Test", body: "Hello" });
      expect(result).toBeNull();
    });

    it("returns null when Notification API is not available", () => {
      // @ts-expect-error - testing undefined case
      globalThis.Notification = undefined;

      const result = showNotification({ title: "Test", body: "Hello" });
      expect(result).toBeNull();
    });
  });

  describe("isDocumentVisible", () => {
    it("returns true when document is visible", () => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      expect(isDocumentVisible()).toBe(true);
    });

    it("returns false when document is hidden", () => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      expect(isDocumentVisible()).toBe(false);
    });
  });
});
