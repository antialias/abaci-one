import { describe, expect, it } from "vitest";
import {
  parsingReducer,
  initialParsingState,
  isParsingAttachment,
  isAnyParsingActive,
  getStreamingStatus,
  type ParsingContextState,
  type ParsingAction,
} from "../state-machine";
import type { WorksheetParsingResult } from "../schemas";

describe("parsingReducer", () => {
  describe("START_STREAMING", () => {
    it("should initialize streaming state for initial parse", () => {
      const action: ParsingAction = {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      };

      const result = parsingReducer(initialParsingState, action);

      expect(result.activeAttachmentId).toBe("attachment-1");
      expect(result.streaming).not.toBeNull();
      expect(result.streaming?.status).toBe("connecting");
      expect(result.streaming?.streamType).toBe("initial");
      expect(result.streaming?.reasoningText).toBe("");
      expect(result.streaming?.outputText).toBe("");
      expect(result.streaming?.completedProblems).toEqual([]);
      expect(result.streaming?.completedIndices).toBeUndefined();
      expect(result.lastError).toBeNull();
    });

    it("should initialize streaming state for reparse with totalProblems", () => {
      const action: ParsingAction = {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "reparse",
        totalProblems: 5,
      };

      const result = parsingReducer(initialParsingState, action);

      expect(result.streaming?.streamType).toBe("reparse");
      expect(result.streaming?.totalProblems).toBe(5);
      expect(result.streaming?.currentProblemIndex).toBe(0);
      expect(result.streaming?.completedIndices).toEqual([]);
    });
  });

  describe("STREAM_REASONING", () => {
    it("should set status to reasoning for initial parse", () => {
      const startedState = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      const action: ParsingAction = {
        type: "STREAM_REASONING",
        text: "Analyzing the worksheet...",
        append: false,
      };

      const result = parsingReducer(startedState, action);

      expect(result.streaming?.status).toBe("reasoning");
      expect(result.streaming?.reasoningText).toBe("Analyzing the worksheet...");
      expect(result.streaming?.progressMessage).toBe("AI is thinking...");
    });

    it("should append text when append is true", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      state = parsingReducer(state, {
        type: "STREAM_REASONING",
        text: "First part. ",
        append: false,
      });

      state = parsingReducer(state, {
        type: "STREAM_REASONING",
        text: "Second part.",
        append: true,
      });

      expect(state.streaming?.reasoningText).toBe("First part. Second part.");
    });

    it("should preserve status for reparse (not change to reasoning)", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "reparse",
        totalProblems: 3,
      });

      // Simulate problem_start which sets status to processing
      state = parsingReducer(state, {
        type: "STREAM_REPARSE_PROGRESS",
        current: 0,
        total: 3,
      });

      expect(state.streaming?.status).toBe("processing");

      // Now send reasoning - status should stay as processing for reparse
      state = parsingReducer(state, {
        type: "STREAM_REASONING",
        text: "Analyzing problem...",
        append: false,
      });

      expect(state.streaming?.status).toBe("processing");
      expect(state.streaming?.reasoningText).toBe("Analyzing problem...");
    });

    it("should return same state if not streaming", () => {
      const action: ParsingAction = {
        type: "STREAM_REASONING",
        text: "test",
        append: false,
      };

      const result = parsingReducer(initialParsingState, action);
      expect(result).toBe(initialParsingState);
    });
  });

  describe("STREAM_OUTPUT", () => {
    it("should accumulate output text and set status to generating", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      state = parsingReducer(state, {
        type: "STREAM_OUTPUT",
        text: '{"problems": [',
      });

      expect(state.streaming?.status).toBe("generating");
      expect(state.streaming?.outputText).toBe('{"problems": [');

      state = parsingReducer(state, {
        type: "STREAM_OUTPUT",
        text: '{"problemNumber": 1}',
      });

      expect(state.streaming?.outputText).toBe('{"problems": [{"problemNumber": 1}');
    });
  });

  describe("STREAM_PROBLEM_COMPLETE", () => {
    it("should add completed problem to array", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      const problem = {
        problemNumber: 1,
        problemBoundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      };

      state = parsingReducer(state, {
        type: "STREAM_PROBLEM_COMPLETE",
        problem,
      });

      expect(state.streaming?.completedProblems).toHaveLength(1);
      expect(state.streaming?.completedProblems[0]).toEqual(problem);
    });

    it("should add to completedIndices for reparse", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "reparse",
        totalProblems: 3,
      });

      const problem = {
        problemNumber: 5,
        problemBoundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      };

      state = parsingReducer(state, {
        type: "STREAM_PROBLEM_COMPLETE",
        problem,
        problemIndex: 2,
      });

      expect(state.streaming?.completedIndices).toContain(2);
    });
  });

  describe("STREAM_REPARSE_PROGRESS", () => {
    it("should update progress for reparse and set status to processing", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "reparse",
        totalProblems: 5,
      });

      state = parsingReducer(state, {
        type: "STREAM_REPARSE_PROGRESS",
        current: 2,
        total: 5,
      });

      expect(state.streaming?.status).toBe("processing");
      expect(state.streaming?.currentProblemIndex).toBe(2);
      expect(state.streaming?.totalProblems).toBe(5);
      expect(state.streaming?.progressMessage).toBe("Analyzing problem 3 of 5...");
    });
  });

  describe("STREAM_PROGRESS_MESSAGE", () => {
    it("should update progress message", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      state = parsingReducer(state, {
        type: "STREAM_PROGRESS_MESSAGE",
        message: "Custom progress message",
      });

      expect(state.streaming?.progressMessage).toBe("Custom progress message");
    });
  });

  describe("PARSE_COMPLETE", () => {
    it("should set streaming status to complete and store result", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      // Use a minimal mock result - the reducer only stores it, doesn't validate
      const result = {
        problems: [{ problemNumber: 1, terms: [1, 2], correctAnswer: 3 }],
        pageMetadata: { lessonId: null, weekId: null, detectedFormat: "vertical" as const },
        overallConfidence: 0.95,
        warnings: [],
        needsReview: false,
      } as unknown as WorksheetParsingResult;

      state = parsingReducer(state, {
        type: "PARSE_COMPLETE",
        result,
        stats: {
          totalProblems: 1,
          correctCount: 1,
          incorrectCount: 0,
          unansweredCount: 0,
          accuracy: 1,
          skillsDetected: [],
        },
      });

      // Streaming state is preserved with terminal status (for UI to show final state)
      expect(state.streaming?.status).toBe("complete");
      expect(state.streaming?.progressMessage).toBeNull();
      expect(state.lastResult).toEqual(result);
      expect(state.lastStats?.totalProblems).toBe(1);
      expect(state.activeAttachmentId).toBeNull();
    });
  });

  describe("PARSE_FAILED", () => {
    it("should set streaming status to error and store error", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      state = parsingReducer(state, {
        type: "PARSE_FAILED",
        error: "Network error occurred",
      });

      // Streaming state is preserved with terminal status (for UI to show error state)
      expect(state.streaming?.status).toBe("error");
      expect(state.streaming?.progressMessage).toBeNull();
      expect(state.lastError).toBe("Network error occurred");
      expect(state.activeAttachmentId).toBeNull();
    });
  });

  describe("CANCEL", () => {
    it("should set streaming status to cancelled", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      state = parsingReducer(state, { type: "CANCEL" });

      // Streaming state is preserved with terminal status (for UI to show cancelled state)
      expect(state.streaming?.status).toBe("cancelled");
      expect(state.streaming?.progressMessage).toBe("Cancelled");
      expect(state.activeAttachmentId).toBeNull();
    });
  });

  describe("RESET", () => {
    it("should reset to initial state", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      state = parsingReducer(state, {
        type: "PARSE_FAILED",
        error: "Some error",
      });

      state = parsingReducer(state, { type: "RESET" });

      expect(state).toEqual(initialParsingState);
    });
  });
});

describe("helper functions", () => {
  describe("isParsingAttachment", () => {
    it("should return true when attachment is actively being parsed", () => {
      const state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      expect(isParsingAttachment(state, "attachment-1")).toBe(true);
      expect(isParsingAttachment(state, "attachment-2")).toBe(false);
    });

    it("should return false when not streaming", () => {
      expect(isParsingAttachment(initialParsingState, "attachment-1")).toBe(false);
    });
  });

  describe("isAnyParsingActive", () => {
    it("should return true when streaming", () => {
      const state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      expect(isAnyParsingActive(state)).toBe(true);
    });

    it("should return false when not streaming", () => {
      expect(isAnyParsingActive(initialParsingState)).toBe(false);
    });
  });

  describe("getStreamingStatus", () => {
    it("should return current streaming status for matching attachment", () => {
      let state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      expect(getStreamingStatus(state, "attachment-1")).toBe("connecting");

      state = parsingReducer(state, {
        type: "STREAM_REASONING",
        text: "test",
        append: false,
      });

      expect(getStreamingStatus(state, "attachment-1")).toBe("reasoning");
    });

    it("should return null for non-matching attachment", () => {
      const state = parsingReducer(initialParsingState, {
        type: "START_STREAMING",
        attachmentId: "attachment-1",
        streamType: "initial",
      });

      expect(getStreamingStatus(state, "attachment-2")).toBeNull();
    });

    it("should return null when not streaming", () => {
      expect(getStreamingStatus(initialParsingState, "attachment-1")).toBeNull();
    });
  });
});
