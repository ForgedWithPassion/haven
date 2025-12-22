import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setDocumentTitle,
  createBadgedFavicon,
  setPWABadge,
  setFaviconBadge,
  supportsPWABadge,
  updateAllBadges,
  resetBadges,
} from "./appBadge";

describe("appBadge utility", () => {
  describe("setDocumentTitle", () => {
    const originalTitle = document.title;

    afterEach(() => {
      document.title = originalTitle;
    });

    it("sets title with count when count > 0", () => {
      setDocumentTitle(5);
      expect(document.title).toBe("(5) Haven");
    });

    it("sets base title when count is 0", () => {
      setDocumentTitle(0);
      expect(document.title).toBe("Haven");
    });

    it("handles large counts", () => {
      setDocumentTitle(999);
      expect(document.title).toBe("(999) Haven");
    });

    it("handles count of 1", () => {
      setDocumentTitle(1);
      expect(document.title).toBe("(1) Haven");
    });
  });

  describe("createBadgedFavicon", () => {
    it("returns a string when count > 0", () => {
      // Create a real image element for testing
      const img = new Image();
      img.width = 32;
      img.height = 32;

      const result = createBadgedFavicon(img, 5);
      // The function creates a canvas and returns toDataURL (or empty string in jsdom)
      expect(typeof result).toBe("string");
    });

    it("returns a string when count is 0", () => {
      const img = new Image();
      img.width = 32;
      img.height = 32;

      const result = createBadgedFavicon(img, 0);
      expect(typeof result).toBe("string");
    });

    it("does not throw with any count value", () => {
      const img = new Image();
      img.width = 32;
      img.height = 32;

      expect(() => createBadgedFavicon(img, 0)).not.toThrow();
      expect(() => createBadgedFavicon(img, 1)).not.toThrow();
      expect(() => createBadgedFavicon(img, 99)).not.toThrow();
      expect(() => createBadgedFavicon(img, 100)).not.toThrow();
    });
  });

  describe("supportsPWABadge", () => {
    it("returns false when setAppBadge not in navigator", () => {
      expect(supportsPWABadge()).toBe(false);
    });

    it("returns true when setAppBadge is in navigator", () => {
      const originalSetAppBadge = (navigator as any).setAppBadge;
      (navigator as any).setAppBadge = vi.fn();
      expect(supportsPWABadge()).toBe(true);
      if (originalSetAppBadge === undefined) {
        delete (navigator as any).setAppBadge;
      } else {
        (navigator as any).setAppBadge = originalSetAppBadge;
      }
    });
  });

  describe("setPWABadge", () => {
    afterEach(() => {
      delete (navigator as any).setAppBadge;
      delete (navigator as any).clearAppBadge;
    });

    it("calls setAppBadge when count > 0 and API exists", () => {
      const mockSetAppBadge = vi.fn().mockResolvedValue(undefined);
      (navigator as any).setAppBadge = mockSetAppBadge;

      setPWABadge(5);

      expect(mockSetAppBadge).toHaveBeenCalledWith(5);
    });

    it("calls clearAppBadge when count is 0 and API exists", () => {
      const mockClearAppBadge = vi.fn().mockResolvedValue(undefined);
      (navigator as any).setAppBadge = vi.fn();
      (navigator as any).clearAppBadge = mockClearAppBadge;

      setPWABadge(0);

      expect(mockClearAppBadge).toHaveBeenCalled();
    });

    it("does not throw when API not available", () => {
      expect(() => setPWABadge(5)).not.toThrow();
    });
  });

  describe("setFaviconBadge", () => {
    let originalLink: HTMLLinkElement | null;

    beforeEach(() => {
      // Store original link if exists
      originalLink = document.querySelector('link[rel="icon"]');

      // Create a test favicon link
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      // Use a data URL that can be loaded
      link.href =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      document.head.appendChild(link);
    });

    afterEach(() => {
      // Remove test links
      document
        .querySelectorAll('link[rel="icon"]')
        .forEach((el) => el.remove());

      // Restore original if it existed
      if (originalLink) {
        document.head.appendChild(originalLink);
      }
    });

    it("does not throw when called", () => {
      expect(() => setFaviconBadge(5)).not.toThrow();
      expect(() => setFaviconBadge(0)).not.toThrow();
    });
  });

  describe("updateAllBadges", () => {
    const originalTitle = document.title;

    afterEach(() => {
      document.title = originalTitle;
    });

    it("updates document title", () => {
      updateAllBadges(3);
      expect(document.title).toBe("(3) Haven");
    });

    it("does not throw when called", () => {
      expect(() => updateAllBadges(5)).not.toThrow();
    });
  });

  describe("resetBadges", () => {
    const originalTitle = document.title;

    afterEach(() => {
      document.title = originalTitle;
    });

    it("resets title to Haven", () => {
      document.title = "(10) Haven";
      resetBadges();
      expect(document.title).toBe("Haven");
    });

    it("does not throw when called", () => {
      expect(() => resetBadges()).not.toThrow();
    });
  });
});
