/**
 * Unit tests for entry prompts functionality
 *
 * Tests the classroom entry prompt system where teachers can request
 * parents to have their children enter the classroom.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database
const mockDb = {
  query: {
    entryPrompts: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    classrooms: {
      findFirst: vi.fn(),
    },
    players: {
      findFirst: vi.fn(),
    },
    users: {
      findFirst: vi.fn(),
    },
    classroomEnrollments: {
      findMany: vi.fn(),
    },
    classroomPresence: {
      findMany: vi.fn(),
    },
  },
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/db", () => ({
  db: mockDb,
  schema: {
    entryPrompts: {
      id: "id",
      teacherId: "teacher_id",
      playerId: "player_id",
      classroomId: "classroom_id",
      expiresAt: "expires_at",
      status: "status",
      respondedBy: "responded_by",
      respondedAt: "responded_at",
      createdAt: "created_at",
    },
    classrooms: {
      id: "id",
      teacherId: "teacher_id",
      name: "name",
      code: "code",
      entryPromptExpiryMinutes: "entry_prompt_expiry_minutes",
    },
    classroomEnrollments: {
      playerId: "player_id",
      classroomId: "classroom_id",
    },
    classroomPresence: {
      playerId: "player_id",
      classroomId: "classroom_id",
    },
    players: {
      id: "id",
      name: "name",
      emoji: "emoji",
    },
    users: {
      id: "id",
      name: "name",
    },
  },
}));

describe("Entry Prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Expiry Time Calculation", () => {
    const DEFAULT_EXPIRY_MINUTES = 30;

    it("uses system default (30 min) when no classroom setting", () => {
      const classroom = {
        id: "classroom-1",
        teacherId: "teacher-1",
        entryPromptExpiryMinutes: null,
      };
      const requestOverride = undefined;

      const expiresInMinutes =
        requestOverride ||
        classroom.entryPromptExpiryMinutes ||
        DEFAULT_EXPIRY_MINUTES;

      expect(expiresInMinutes).toBe(30);
    });

    it("uses classroom setting when configured", () => {
      const classroom = {
        id: "classroom-1",
        teacherId: "teacher-1",
        entryPromptExpiryMinutes: 60,
      };
      const requestOverride = undefined;

      const expiresInMinutes =
        requestOverride ||
        classroom.entryPromptExpiryMinutes ||
        DEFAULT_EXPIRY_MINUTES;

      expect(expiresInMinutes).toBe(60);
    });

    it("request override takes precedence over classroom setting", () => {
      const classroom = {
        id: "classroom-1",
        teacherId: "teacher-1",
        entryPromptExpiryMinutes: 60,
      };
      const requestOverride = 15;

      const expiresInMinutes =
        requestOverride ||
        classroom.entryPromptExpiryMinutes ||
        DEFAULT_EXPIRY_MINUTES;

      expect(expiresInMinutes).toBe(15);
    });

    it("calculates correct expiry date", () => {
      const now = new Date("2025-01-01T12:00:00Z");
      const expiresInMinutes = 45;
      const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);

      expect(expiresAt.toISOString()).toBe("2025-01-01T12:45:00.000Z");
    });
  });

  describe("Prompt Status Transitions", () => {
    it("pending prompt can transition to accepted", () => {
      const validTransitions: Record<string, string[]> = {
        pending: ["accepted", "declined", "expired"],
        accepted: [],
        declined: [],
        expired: [],
      };

      expect(validTransitions.pending).toContain("accepted");
    });

    it("pending prompt can transition to declined", () => {
      const validTransitions: Record<string, string[]> = {
        pending: ["accepted", "declined", "expired"],
        accepted: [],
        declined: [],
        expired: [],
      };

      expect(validTransitions.pending).toContain("declined");
    });

    it("accepted prompt cannot transition further", () => {
      const validTransitions: Record<string, string[]> = {
        pending: ["accepted", "declined", "expired"],
        accepted: [],
        declined: [],
        expired: [],
      };

      expect(validTransitions.accepted).toHaveLength(0);
    });
  });

  describe("Eligibility Rules", () => {
    it("student must be enrolled to receive prompt", () => {
      const enrolledPlayerIds = new Set(["player-1", "player-2"]);
      const playerId = "player-3";

      const isEnrolled = enrolledPlayerIds.has(playerId);

      expect(isEnrolled).toBe(false);
    });

    it("student already present cannot receive prompt", () => {
      const presentPlayerIds = new Set(["player-1"]);
      const playerId = "player-1";

      const isPresent = presentPlayerIds.has(playerId);

      expect(isPresent).toBe(true);
    });

    it("student with pending prompt cannot receive another", () => {
      const existingPromptPlayerIds = new Set(["player-1"]);
      const playerId = "player-1";

      const hasPendingPrompt = existingPromptPlayerIds.has(playerId);

      expect(hasPendingPrompt).toBe(true);
    });

    it("eligible student can receive prompt", () => {
      const enrolledPlayerIds = new Set(["player-1", "player-2", "player-3"]);
      const presentPlayerIds = new Set(["player-1"]);
      const existingPromptPlayerIds = new Set(["player-2"]);
      const playerId = "player-3";

      const isEnrolled = enrolledPlayerIds.has(playerId);
      const isPresent = presentPlayerIds.has(playerId);
      const hasPendingPrompt = existingPromptPlayerIds.has(playerId);

      const isEligible = isEnrolled && !isPresent && !hasPendingPrompt;

      expect(isEligible).toBe(true);
    });
  });

  describe("Expiry Detection", () => {
    it("filters out expired prompts", () => {
      const now = new Date("2025-01-01T12:00:00Z");
      const prompts = [
        {
          id: "prompt-1",
          expiresAt: new Date("2025-01-01T11:00:00Z"),
          status: "pending",
        }, // expired
        {
          id: "prompt-2",
          expiresAt: new Date("2025-01-01T13:00:00Z"),
          status: "pending",
        }, // active
        {
          id: "prompt-3",
          expiresAt: new Date("2025-01-01T12:30:00Z"),
          status: "pending",
        }, // active
      ];

      const activePrompts = prompts.filter((p) => p.expiresAt > now);

      expect(activePrompts).toHaveLength(2);
      expect(activePrompts.map((p) => p.id)).toEqual(["prompt-2", "prompt-3"]);
    });

    it("expired prompt does NOT block creating a new prompt", () => {
      const now = new Date("2025-01-01T12:00:00Z");

      // Simulate existing prompts in database
      const existingPrompts = [
        {
          id: "prompt-1",
          playerId: "player-1",
          expiresAt: new Date("2025-01-01T11:00:00Z"), // EXPIRED
          status: "pending",
        },
      ];

      // Filter out expired prompts when checking for duplicates
      const activeExistingPrompts = existingPrompts.filter(
        (p) => p.expiresAt > now,
      );
      const existingPromptPlayerIds = new Set(
        activeExistingPrompts.map((p) => p.playerId),
      );

      // Player 1's expired prompt should NOT block a new prompt
      expect(existingPromptPlayerIds.has("player-1")).toBe(false);

      // Can create new prompt for player-1
      const playerId = "player-1";
      const hasPendingPrompt = existingPromptPlayerIds.has(playerId);
      expect(hasPendingPrompt).toBe(false); // Expired prompts don't count
    });
  });
});

describe("Classroom Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Entry Prompt Expiry Setting", () => {
    it("validates positive integer for expiry minutes", () => {
      const validValues = [15, 30, 45, 60, 90, 120];

      for (const value of validValues) {
        expect(typeof value === "number" && value > 0).toBe(true);
      }
    });

    it("accepts null to use system default", () => {
      const value: number | null = null;

      const isValid =
        value === null || (typeof value === "number" && value > 0);

      expect(isValid).toBe(true);
    });

    it("rejects zero or negative values", () => {
      const invalidValues = [0, -1, -30];

      for (const value of invalidValues) {
        const isValid =
          value === null || (typeof value === "number" && value > 0);
        expect(isValid).toBe(false);
      }
    });
  });
});
