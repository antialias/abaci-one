import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database module
vi.mock("@/db", () => {
  const mockFindMany = vi.fn();
  const mockFindFirst = vi.fn();

  return {
    db: {
      query: {
        sessionPlans: {
          findMany: mockFindMany,
          findFirst: mockFindFirst,
        },
      },
    },
    schema: {
      sessionPlans: {
        id: "id",
        playerId: "player_id",
        status: "status",
        completedAt: "completed_at",
      },
    },
  };
});

// Import after mocking
import { db } from "@/db";
import { getPaginatedSessions } from "../progress-manager";

// Helper to create mock session data
function createMockSession(
  id: string,
  completedAt: Date,
  problemCount: number = 10,
): Record<string, unknown> {
  return {
    id,
    playerId: "test-player",
    status: "completed",
    completedAt,
    createdAt: completedAt,
    startedAt: completedAt,
    results: Array.from({ length: problemCount }, (_, i) => ({
      isCorrect: i % 2 === 0,
      responseTimeMs: 3000 + i * 100,
      skillsExercised: [`skill-${i % 3}`],
    })),
  };
}

describe("getPaginatedSessions", () => {
  const mockFindMany = db.query.sessionPlans.findMany as ReturnType<
    typeof vi.fn
  >;
  const mockFindFirst = db.query.sessionPlans.findFirst as ReturnType<
    typeof vi.fn
  >;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("first page (no cursor)", () => {
    it("should return first page of sessions with hasMore=true when more exist", async () => {
      // Create 21 mock sessions (limit + 1 to check for more)
      const mockSessions = Array.from({ length: 21 }, (_, i) =>
        createMockSession(`session-${i}`, new Date(2024, 0, 21 - i)),
      );
      mockFindMany.mockResolvedValue(mockSessions);

      const result = await getPaginatedSessions("test-player", 20);

      expect(result.sessions).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("session-19");
    });

    it("should return all sessions with hasMore=false when fewer than limit", async () => {
      const mockSessions = Array.from({ length: 5 }, (_, i) =>
        createMockSession(`session-${i}`, new Date(2024, 0, 5 - i)),
      );
      mockFindMany.mockResolvedValue(mockSessions);

      const result = await getPaginatedSessions("test-player", 20);

      expect(result.sessions).toHaveLength(5);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("should return empty array when no sessions exist", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await getPaginatedSessions("test-player", 20);

      expect(result.sessions).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe("subsequent pages (with cursor)", () => {
    it("should fetch sessions older than cursor", async () => {
      const cursorSession = createMockSession(
        "cursor-session",
        new Date(2024, 0, 15),
      );
      const olderSessions = Array.from({ length: 21 }, (_, i) =>
        createMockSession(`session-${i}`, new Date(2024, 0, 14 - i)),
      );

      mockFindFirst.mockResolvedValue(cursorSession);
      mockFindMany.mockResolvedValue(olderSessions);

      const result = await getPaginatedSessions(
        "test-player",
        20,
        "cursor-session",
      );

      expect(mockFindFirst).toHaveBeenCalled();
      expect(result.sessions).toHaveLength(20);
      expect(result.hasMore).toBe(true);
    });

    it("should return remaining sessions when cursor is near the end", async () => {
      const cursorSession = createMockSession(
        "cursor-session",
        new Date(2024, 0, 5),
      );
      const olderSessions = Array.from({ length: 3 }, (_, i) =>
        createMockSession(`session-${i}`, new Date(2024, 0, 4 - i)),
      );

      mockFindFirst.mockResolvedValue(cursorSession);
      mockFindMany.mockResolvedValue(olderSessions);

      const result = await getPaginatedSessions(
        "test-player",
        20,
        "cursor-session",
      );

      expect(result.sessions).toHaveLength(3);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("should handle cursor not found gracefully", async () => {
      mockFindFirst.mockResolvedValue(null);
      mockFindMany.mockResolvedValue([]);

      const result = await getPaginatedSessions(
        "test-player",
        20,
        "non-existent-cursor",
      );

      expect(result.sessions).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("session transformation", () => {
    it("should correctly transform session data to PracticeSession format", async () => {
      const mockSession = createMockSession(
        "session-1",
        new Date("2024-01-15T10:00:00Z"),
        10,
      );
      mockFindMany.mockResolvedValue([mockSession]);

      const result = await getPaginatedSessions("test-player", 20);

      expect(result.sessions).toHaveLength(1);
      const session = result.sessions[0];
      expect(session.id).toBe("session-1");
      expect(session.playerId).toBe("test-player");
      expect(session.problemsAttempted).toBe(10);
      expect(session.problemsCorrect).toBe(5); // Half correct based on mock
      expect(session.skillsUsed).toContain("skill-0");
      expect(session.skillsUsed).toContain("skill-1");
      expect(session.skillsUsed).toContain("skill-2");
    });

    it("should handle sessions with no results", async () => {
      const mockSession = {
        ...createMockSession("session-1", new Date("2024-01-15T10:00:00Z")),
        results: [],
      };
      mockFindMany.mockResolvedValue([mockSession]);

      const result = await getPaginatedSessions("test-player", 20);

      expect(result.sessions).toHaveLength(1);
      const session = result.sessions[0];
      expect(session.problemsAttempted).toBe(0);
      expect(session.problemsCorrect).toBe(0);
      expect(session.averageTimeMs).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle exactly limit sessions (hasMore should be false)", async () => {
      const mockSessions = Array.from({ length: 20 }, (_, i) =>
        createMockSession(`session-${i}`, new Date(2024, 0, 20 - i)),
      );
      mockFindMany.mockResolvedValue(mockSessions);

      const result = await getPaginatedSessions("test-player", 20);

      expect(result.sessions).toHaveLength(20);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("should handle limit of 1", async () => {
      const mockSessions = [
        createMockSession("session-0", new Date(2024, 0, 2)),
        createMockSession("session-1", new Date(2024, 0, 1)),
      ];
      mockFindMany.mockResolvedValue(mockSessions);

      const result = await getPaginatedSessions("test-player", 1);

      expect(result.sessions).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("session-0");
    });

    it("should use default limit of 20 when not specified", async () => {
      const mockSessions = Array.from({ length: 21 }, (_, i) =>
        createMockSession(`session-${i}`, new Date(2024, 0, 21 - i)),
      );
      mockFindMany.mockResolvedValue(mockSessions);

      const result = await getPaginatedSessions("test-player");

      expect(result.sessions).toHaveLength(20);
      expect(result.hasMore).toBe(true);
    });
  });
});
