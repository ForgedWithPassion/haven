import { describe, it, expect } from "vitest";
import { formatTime } from "./formatTime";

describe("formatTime utility", () => {
  // Use fixed timestamps for consistent testing
  // 14:30:00 on Jan 1, 2024
  const afternoon = new Date(2024, 0, 1, 14, 30, 0).getTime();
  // 02:30:00 on Jan 1, 2024
  const morning = new Date(2024, 0, 1, 2, 30, 0).getTime();
  // 00:00:00 (midnight)
  const midnight = new Date(2024, 0, 1, 0, 0, 0).getTime();
  // 12:00:00 (noon)
  const noon = new Date(2024, 0, 1, 12, 0, 0).getTime();

  describe("24-hour format", () => {
    it("formats afternoon time correctly", () => {
      const result = formatTime(afternoon, true);
      expect(result).toBe("14:30");
    });

    it("formats morning time correctly", () => {
      const result = formatTime(morning, true);
      expect(result).toBe("02:30");
    });

    it("formats midnight correctly", () => {
      const result = formatTime(midnight, true);
      expect(result).toBe("00:00");
    });

    it("formats noon correctly", () => {
      const result = formatTime(noon, true);
      expect(result).toBe("12:00");
    });
  });

  describe("12-hour format", () => {
    it("formats afternoon time correctly", () => {
      const result = formatTime(afternoon, false);
      expect(result).toMatch(/^0?2:30\s*PM$/i);
    });

    it("formats morning time correctly", () => {
      const result = formatTime(morning, false);
      expect(result).toMatch(/^0?2:30\s*AM$/i);
    });

    it("formats midnight correctly", () => {
      const result = formatTime(midnight, false);
      expect(result).toMatch(/^12:00\s*AM$/i);
    });

    it("formats noon correctly", () => {
      const result = formatTime(noon, false);
      expect(result).toMatch(/^12:00\s*PM$/i);
    });
  });

  describe("edge cases", () => {
    it("handles current time", () => {
      const now = Date.now();
      expect(() => formatTime(now, true)).not.toThrow();
      expect(() => formatTime(now, false)).not.toThrow();
    });

    it("returns a string", () => {
      expect(typeof formatTime(afternoon, true)).toBe("string");
      expect(typeof formatTime(afternoon, false)).toBe("string");
    });
  });
});
