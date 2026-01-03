/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  createGuestToken,
  GUEST_COOKIE_NAME,
  verifyGuestToken,
} from "../guest-token";

describe("Guest Token Utilities", () => {
  beforeEach(() => {
    // Set AUTH_SECRET for tests
    process.env.AUTH_SECRET = "test-secret-key-for-jwt-signing";
  });

  describe("GUEST_COOKIE_NAME", () => {
    it("uses __Host- prefix in production, plain name in dev", () => {
      // In test environment, NODE_ENV is not 'production'
      expect(GUEST_COOKIE_NAME).toBe("guest");
    });
  });

  describe("createGuestToken", () => {
    it("creates a valid JWT token", async () => {
      const sid = "test-session-id";
      const token = await createGuestToken(sid);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("includes session ID in payload", async () => {
      const sid = "test-session-id-123";
      const token = await createGuestToken(sid);
      const verified = await verifyGuestToken(token);

      expect(verified.sid).toBe(sid);
    });

    it("sets expiration time correctly", async () => {
      const sid = "test-session-id";
      const maxAgeSec = 3600; // 1 hour
      const token = await createGuestToken(sid, maxAgeSec);
      const verified = await verifyGuestToken(token);

      const now = Math.floor(Date.now() / 1000);
      expect(verified.exp).toBeGreaterThan(now);
      expect(verified.exp).toBeLessThanOrEqual(now + maxAgeSec + 5); // +5 for clock skew
    });

    it("sets issued at time", async () => {
      const sid = "test-session-id";
      const token = await createGuestToken(sid);
      const verified = await verifyGuestToken(token);

      const now = Math.floor(Date.now() / 1000);
      expect(verified.iat).toBeLessThanOrEqual(now);
      expect(verified.iat).toBeGreaterThan(now - 10); // Within last 10 seconds
    });

    it("throws if AUTH_SECRET is missing", async () => {
      delete process.env.AUTH_SECRET;

      await expect(createGuestToken("test")).rejects.toThrow(
        "AUTH_SECRET environment variable is required",
      );
    });
  });

  describe("verifyGuestToken", () => {
    it("verifies valid tokens", async () => {
      const sid = "test-session-id";
      const token = await createGuestToken(sid);

      const result = await verifyGuestToken(token);

      expect(result).toBeDefined();
      expect(result.sid).toBe(sid);
      expect(result.iat).toBeDefined();
      expect(result.exp).toBeDefined();
    });

    it("rejects invalid tokens", async () => {
      const invalidToken = "invalid.jwt.token";

      await expect(verifyGuestToken(invalidToken)).rejects.toThrow();
    });

    it("rejects tokens with wrong payload type", async () => {
      // Manually create a token with wrong type
      const { SignJWT } = await import("jose");
      const key = new TextEncoder().encode(process.env.AUTH_SECRET!);
      const wrongToken = await new SignJWT({ typ: "wrong", sid: "test" })
        .setProtectedHeader({ alg: "HS256" })
        .sign(key);

      await expect(verifyGuestToken(wrongToken)).rejects.toThrow(
        "Invalid guest token payload",
      );
    });

    it("rejects tokens without sid", async () => {
      // Manually create a token without sid
      const { SignJWT } = await import("jose");
      const key = new TextEncoder().encode(process.env.AUTH_SECRET!);
      const wrongToken = await new SignJWT({ typ: "guest" })
        .setProtectedHeader({ alg: "HS256" })
        .sign(key);

      await expect(verifyGuestToken(wrongToken)).rejects.toThrow(
        "Invalid guest token payload",
      );
    });

    it("rejects expired tokens", async () => {
      const sid = "test-session-id";
      const token = await createGuestToken(sid, -1); // Expired 1 second ago

      await expect(verifyGuestToken(token)).rejects.toThrow();
    });

    it("rejects tokens signed with wrong secret", async () => {
      const sid = "test-session-id";
      const token = await createGuestToken(sid);

      // Change the secret
      process.env.AUTH_SECRET = "different-secret";

      await expect(verifyGuestToken(token)).rejects.toThrow();
    });
  });

  describe("Token lifecycle", () => {
    it("supports create → verify → decode flow", async () => {
      const sid = crypto.randomUUID();
      const maxAgeSec = 7200; // 2 hours

      // Create token
      const token = await createGuestToken(sid, maxAgeSec);

      // Verify token
      const verified = await verifyGuestToken(token);

      // Check all fields
      expect(verified.sid).toBe(sid);
      expect(verified.iat).toBeDefined();
      expect(verified.exp).toBe(verified.iat + maxAgeSec);
    });

    it("tokens have same sid for same input", async () => {
      const sid = "same-session-id";

      // Creating tokens at different times
      const token1 = await createGuestToken(sid);

      // Wait at least 1 second to ensure different iat
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const token2 = await createGuestToken(sid);

      // Tokens may be different (different iat) or same (if created in same second)
      // But both should verify with same sid
      const verified1 = await verifyGuestToken(token1);
      const verified2 = await verifyGuestToken(token2);
      expect(verified1.sid).toBe(verified2.sid);
      expect(verified1.sid).toBe(sid);
    });
  });
});
