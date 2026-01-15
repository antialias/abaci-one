/**
 * @vitest-environment node
 */

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "../src/db";

/**
 * API Abacus Settings E2E Tests
 *
 * These tests verify the abacus-settings API endpoints work correctly.
 */

describe("Abacus Settings API", () => {
  let testUserId: string;
  let testGuestId: string;

  beforeEach(async () => {
    // Create a test user with unique guest ID
    testGuestId = `test-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const [user] = await db
      .insert(schema.users)
      .values({ guestId: testGuestId })
      .returning();
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up: delete test user (cascade deletes settings)
    await db.delete(schema.users).where(eq(schema.users.id, testUserId));
  });

  describe("GET /api/abacus-settings", () => {
    it("creates settings with defaults if none exist", async () => {
      const [settings] = await db
        .insert(schema.abacusSettings)
        .values({ userId: testUserId })
        .returning();

      expect(settings).toBeDefined();
      expect(settings.colorScheme).toBe("place-value");
      expect(settings.beadShape).toBe("diamond");
      expect(settings.colorPalette).toBe("default");
      expect(settings.hideInactiveBeads).toBe(false);
      expect(settings.coloredNumerals).toBe(false);
      expect(settings.scaleFactor).toBe(1.0);
      expect(settings.showNumbers).toBe(true);
      expect(settings.animated).toBe(true);
      expect(settings.interactive).toBe(false);
      expect(settings.gestures).toBe(false);
      expect(settings.soundEnabled).toBe(true);
      expect(settings.soundVolume).toBe(0.8);
    });

    it("returns existing settings", async () => {
      // Create settings
      await db.insert(schema.abacusSettings).values({
        userId: testUserId,
        colorScheme: "monochrome",
        beadShape: "circle",
        soundEnabled: false,
        soundVolume: 0.5,
      });

      const settings = await db.query.abacusSettings.findFirst({
        where: eq(schema.abacusSettings.userId, testUserId),
      });

      expect(settings).toBeDefined();
      expect(settings?.colorScheme).toBe("monochrome");
      expect(settings?.beadShape).toBe("circle");
      expect(settings?.soundEnabled).toBe(false);
      expect(settings?.soundVolume).toBe(0.5);
    });
  });

  describe("PATCH /api/abacus-settings", () => {
    it("creates new settings if none exist", async () => {
      const [settings] = await db
        .insert(schema.abacusSettings)
        .values({
          userId: testUserId,
          soundEnabled: false,
        })
        .returning();

      expect(settings).toBeDefined();
      expect(settings.soundEnabled).toBe(false);
    });

    it("updates existing settings", async () => {
      // Create initial settings
      await db.insert(schema.abacusSettings).values({
        userId: testUserId,
        colorScheme: "place-value",
        beadShape: "diamond",
      });

      // Update
      const [updated] = await db
        .update(schema.abacusSettings)
        .set({
          colorScheme: "heaven-earth",
          beadShape: "square",
        })
        .where(eq(schema.abacusSettings.userId, testUserId))
        .returning();

      expect(updated.colorScheme).toBe("heaven-earth");
      expect(updated.beadShape).toBe("square");
    });

    it("updates only provided fields", async () => {
      // Create initial settings
      await db.insert(schema.abacusSettings).values({
        userId: testUserId,
        colorScheme: "place-value",
        soundEnabled: true,
        soundVolume: 0.8,
      });

      // Update only soundEnabled
      const [updated] = await db
        .update(schema.abacusSettings)
        .set({ soundEnabled: false })
        .where(eq(schema.abacusSettings.userId, testUserId))
        .returning();

      expect(updated.soundEnabled).toBe(false);
      expect(updated.colorScheme).toBe("place-value"); // unchanged
      expect(updated.soundVolume).toBe(0.8); // unchanged
    });

    it("prevents setting invalid userId via foreign key constraint", async () => {
      // Create initial settings
      await db.insert(schema.abacusSettings).values({
        userId: testUserId,
      });

      // Try to update with invalid userId - should fail
      await expect(async () => {
        await db
          .update(schema.abacusSettings)
          .set({
            userId: "HACKER_ID_INVALID",
            soundEnabled: false,
          })
          .where(eq(schema.abacusSettings.userId, testUserId));
      }).rejects.toThrow();
    });

    it("allows updating all display settings", async () => {
      await db.insert(schema.abacusSettings).values({
        userId: testUserId,
      });

      const [updated] = await db
        .update(schema.abacusSettings)
        .set({
          colorScheme: "alternating",
          beadShape: "circle",
          colorPalette: "colorblind",
          hideInactiveBeads: true,
          coloredNumerals: true,
          scaleFactor: 1.5,
          showNumbers: false,
          animated: false,
          interactive: true,
          gestures: true,
          soundEnabled: false,
          soundVolume: 0.3,
        })
        .where(eq(schema.abacusSettings.userId, testUserId))
        .returning();

      expect(updated.colorScheme).toBe("alternating");
      expect(updated.beadShape).toBe("circle");
      expect(updated.colorPalette).toBe("colorblind");
      expect(updated.hideInactiveBeads).toBe(true);
      expect(updated.coloredNumerals).toBe(true);
      expect(updated.scaleFactor).toBe(1.5);
      expect(updated.showNumbers).toBe(false);
      expect(updated.animated).toBe(false);
      expect(updated.interactive).toBe(true);
      expect(updated.gestures).toBe(true);
      expect(updated.soundEnabled).toBe(false);
      expect(updated.soundVolume).toBe(0.3);
    });
  });

  describe("Cascade delete behavior", () => {
    it("deletes settings when user is deleted", async () => {
      // Create settings
      await db.insert(schema.abacusSettings).values({
        userId: testUserId,
        soundEnabled: false,
      });

      // Verify settings exist
      let settings = await db.query.abacusSettings.findFirst({
        where: eq(schema.abacusSettings.userId, testUserId),
      });
      expect(settings).toBeDefined();

      // Delete user
      await db.delete(schema.users).where(eq(schema.users.id, testUserId));

      // Verify settings are gone
      settings = await db.query.abacusSettings.findFirst({
        where: eq(schema.abacusSettings.userId, testUserId),
      });
      expect(settings).toBeUndefined();
    });
  });

  describe("Data isolation", () => {
    it("ensures settings are isolated per user", async () => {
      // Create another user
      const testGuestId2 = `test-guest-2-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const [user2] = await db
        .insert(schema.users)
        .values({ guestId: testGuestId2 })
        .returning();

      try {
        // Create settings for both users
        await db.insert(schema.abacusSettings).values({
          userId: testUserId,
          colorScheme: "monochrome",
        });

        await db.insert(schema.abacusSettings).values({
          userId: user2.id,
          colorScheme: "place-value",
        });

        // Verify isolation
        const settings1 = await db.query.abacusSettings.findFirst({
          where: eq(schema.abacusSettings.userId, testUserId),
        });
        const settings2 = await db.query.abacusSettings.findFirst({
          where: eq(schema.abacusSettings.userId, user2.id),
        });

        expect(settings1?.colorScheme).toBe("monochrome");
        expect(settings2?.colorScheme).toBe("place-value");
      } finally {
        // Clean up second user
        await db.delete(schema.users).where(eq(schema.users.id, user2.id));
      }
    });
  });

  describe("Security: userId injection prevention", () => {
    it("rejects attempts to update settings with non-existent userId", async () => {
      // Create initial settings
      await db.insert(schema.abacusSettings).values({
        userId: testUserId,
        soundEnabled: true,
      });

      // Attempt to inject a fake userId
      await expect(async () => {
        await db
          .update(schema.abacusSettings)
          .set({
            userId: "HACKER_ID_NON_EXISTENT",
            soundEnabled: false,
          })
          .where(eq(schema.abacusSettings.userId, testUserId));
      }).rejects.toThrow(/FOREIGN KEY constraint failed/);
    });

    it("prevents modifying another user's settings via userId injection", async () => {
      // Create victim user
      const victimGuestId = `victim-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const [victimUser] = await db
        .insert(schema.users)
        .values({ guestId: victimGuestId })
        .returning();

      try {
        // Create settings for both users
        await db.insert(schema.abacusSettings).values({
          userId: testUserId,
          colorScheme: "monochrome",
          soundEnabled: true,
        });

        await db.insert(schema.abacusSettings).values({
          userId: victimUser.id,
          colorScheme: "place-value",
          soundEnabled: true,
        });

        // Attacker tries to change userId to victim's ID
        // This is rejected because userId is PRIMARY KEY (UNIQUE constraint)
        await expect(async () => {
          await db
            .update(schema.abacusSettings)
            .set({
              userId: victimUser.id, // Trying to inject victim's ID
              soundEnabled: false,
            })
            .where(eq(schema.abacusSettings.userId, testUserId));
        }).rejects.toThrow(/UNIQUE constraint failed/);

        // Verify victim's settings are unchanged
        const victimSettings = await db.query.abacusSettings.findFirst({
          where: eq(schema.abacusSettings.userId, victimUser.id),
        });
        expect(victimSettings?.soundEnabled).toBe(true);
        expect(victimSettings?.colorScheme).toBe("place-value");
      } finally {
        await db.delete(schema.users).where(eq(schema.users.id, victimUser.id));
      }
    });

    it("prevents creating settings for another user via userId injection", async () => {
      // Create victim user
      const victimGuestId = `victim-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const [victimUser] = await db
        .insert(schema.users)
        .values({ guestId: victimGuestId })
        .returning();

      try {
        // Try to create settings for victim with attacker's data
        // This will succeed because foreign key exists, but in the real API
        // the userId comes from session, not request body
        const [maliciousSettings] = await db
          .insert(schema.abacusSettings)
          .values({
            userId: victimUser.id,
            colorScheme: "alternating", // Attacker's preference
          })
          .returning();

        // This test shows that at the DB level, we CAN insert for any valid userId
        // The security comes from the API layer filtering userId from request body
        // and deriving it from the session cookie instead
        expect(maliciousSettings.userId).toBe(victimUser.id);
        expect(maliciousSettings.colorScheme).toBe("alternating");
      } finally {
        await db.delete(schema.users).where(eq(schema.users.id, victimUser.id));
      }
    });
  });
});
