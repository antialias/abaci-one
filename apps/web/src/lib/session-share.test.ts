/**
 * Tests for session share token utilities
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  generateShareToken,
  isValidShareToken,
  getExpirationTime,
  type ShareDuration,
} from "./session-share";

describe("session-share utilities", () => {
  describe("generateShareToken", () => {
    it("generates a 10-character token", () => {
      const token = generateShareToken();
      expect(token.length).toBe(10);
    });

    it("generates only base62 characters", () => {
      const base62Pattern = /^[0-9a-zA-Z]+$/;
      // Generate multiple tokens to increase confidence
      for (let i = 0; i < 100; i++) {
        const token = generateShareToken();
        expect(token).toMatch(base62Pattern);
      }
    });

    it("generates unique tokens", () => {
      const tokens = new Set<string>();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        tokens.add(generateShareToken());
      }

      // All tokens should be unique
      expect(tokens.size).toBe(count);
    });

    it("uses cryptographically random values", () => {
      // Verify crypto.getRandomValues is called
      const mockGetRandomValues = vi.spyOn(crypto, "getRandomValues");

      generateShareToken();

      expect(mockGetRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      mockGetRandomValues.mockRestore();
    });
  });

  describe("isValidShareToken", () => {
    it("returns true for valid 10-char base62 tokens", () => {
      expect(isValidShareToken("abcdef1234")).toBe(true);
      expect(isValidShareToken("ABCDEFGHIJ")).toBe(true);
      expect(isValidShareToken("0123456789")).toBe(true);
      expect(isValidShareToken("aA1bB2cC3d")).toBe(true);
    });

    it("returns false for tokens with wrong length", () => {
      expect(isValidShareToken("")).toBe(false);
      expect(isValidShareToken("abc")).toBe(false);
      expect(isValidShareToken("abcdef123")).toBe(false); // 9 chars
      expect(isValidShareToken("abcdef12345")).toBe(false); // 11 chars
      expect(isValidShareToken("abcdefghijklmnop")).toBe(false); // 16 chars
    });

    it("returns false for tokens with invalid characters", () => {
      expect(isValidShareToken("abcde!@#$%")).toBe(false);
      expect(isValidShareToken("abc def123")).toBe(false); // space
      expect(isValidShareToken("abcdef123_")).toBe(false); // underscore
      expect(isValidShareToken("abcdef123-")).toBe(false); // hyphen
      expect(isValidShareToken("abcdef123.")).toBe(false); // period
    });

    it("validates generated tokens as valid", () => {
      for (let i = 0; i < 100; i++) {
        const token = generateShareToken();
        expect(isValidShareToken(token)).toBe(true);
      }
    });
  });

  describe("getExpirationTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns 1 hour from now for "1h" duration', () => {
      const now = new Date("2025-01-15T12:00:00.000Z");
      vi.setSystemTime(now);

      const expiration = getExpirationTime("1h");

      expect(expiration.getTime()).toBe(now.getTime() + 60 * 60 * 1000);
      expect(expiration.toISOString()).toBe("2025-01-15T13:00:00.000Z");
    });

    it('returns 24 hours from now for "24h" duration', () => {
      const now = new Date("2025-01-15T12:00:00.000Z");
      vi.setSystemTime(now);

      const expiration = getExpirationTime("24h");

      expect(expiration.getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000);
      expect(expiration.toISOString()).toBe("2025-01-16T12:00:00.000Z");
    });

    it("handles edge cases around midnight", () => {
      const now = new Date("2025-01-15T23:30:00.000Z");
      vi.setSystemTime(now);

      const oneHour = getExpirationTime("1h");
      expect(oneHour.toISOString()).toBe("2025-01-16T00:30:00.000Z");

      const twentyFourHours = getExpirationTime("24h");
      expect(twentyFourHours.toISOString()).toBe("2025-01-16T23:30:00.000Z");
    });

    it("handles leap year dates", () => {
      // Feb 28, 2024 (leap year)
      const now = new Date("2024-02-28T12:00:00.000Z");
      vi.setSystemTime(now);

      const twentyFourHours = getExpirationTime("24h");
      expect(twentyFourHours.toISOString()).toBe("2024-02-29T12:00:00.000Z");
    });
  });
});
