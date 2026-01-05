import { describe, expect, it, vi } from "vitest";
import {
  parseSSEStream,
  extractCompletedProblemsFromPartialJson,
  type SSECallbacks,
} from "../sse-parser";

/**
 * Helper to create a mock Response with SSE data
 */
function createSSEResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const data = events.join("\n") + "\n";

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });

  return new Response(stream);
}

/**
 * Helper to format an SSE event
 */
function sseEvent(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}`;
}

describe("parseSSEStream", () => {
  describe("connection events", () => {
    it("should call onStarted for 'started' event", async () => {
      const onStarted = vi.fn();
      const response = createSSEResponse([
        sseEvent("started", { responseId: "resp-123" }),
      ]);

      await parseSSEStream(response, { onStarted });

      expect(onStarted).toHaveBeenCalledWith("resp-123");
    });

    it("should call onStarted for 'response.created' event", async () => {
      const onStarted = vi.fn();
      const response = createSSEResponse([
        sseEvent("response.created", { response: { id: "resp-456" } }),
      ]);

      await parseSSEStream(response, { onStarted });

      expect(onStarted).toHaveBeenCalledWith("resp-456");
    });
  });

  describe("progress events", () => {
    it("should call onProgress with message", async () => {
      const onProgress = vi.fn();
      const response = createSSEResponse([
        sseEvent("progress", { message: "Analyzing worksheet..." }),
      ]);

      await parseSSEStream(response, { onProgress });

      expect(onProgress).toHaveBeenCalledWith("Analyzing worksheet...");
    });
  });

  describe("reasoning events", () => {
    it("should call onReasoning with text and isDelta", async () => {
      const onReasoning = vi.fn();
      const response = createSSEResponse([
        sseEvent("reasoning", { text: "Looking at the image...", isDelta: true }),
      ]);

      await parseSSEStream(response, { onReasoning });

      expect(onReasoning).toHaveBeenCalledWith(
        "Looking at the image...",
        true,
        undefined,
      );
    });

    it("should pass summaryIndex when provided", async () => {
      const onReasoning = vi.fn();
      const response = createSSEResponse([
        sseEvent("reasoning", {
          text: "Summary text",
          isDelta: false,
          summaryIndex: 0,
        }),
      ]);

      await parseSSEStream(response, { onReasoning });

      expect(onReasoning).toHaveBeenCalledWith("Summary text", false, 0);
    });
  });

  describe("output_delta events", () => {
    it("should call onOutputDelta with text", async () => {
      const onOutputDelta = vi.fn();
      const response = createSSEResponse([
        sseEvent("output_delta", { text: '{"problems": [' }),
      ]);

      await parseSSEStream(response, { onOutputDelta });

      expect(onOutputDelta).toHaveBeenCalledWith('{"problems": [', undefined);
    });

    it("should handle delta property as fallback", async () => {
      const onOutputDelta = vi.fn();
      const response = createSSEResponse([
        sseEvent("output_delta", { delta: '{"key": "value"}' }),
      ]);

      await parseSSEStream(response, { onOutputDelta });

      expect(onOutputDelta).toHaveBeenCalledWith('{"key": "value"}', undefined);
    });

    it("should pass outputIndex when provided", async () => {
      const onOutputDelta = vi.fn();
      const response = createSSEResponse([
        sseEvent("output_delta", { text: "data", outputIndex: 1 }),
      ]);

      await parseSSEStream(response, { onOutputDelta });

      expect(onOutputDelta).toHaveBeenCalledWith("data", 1);
    });
  });

  describe("problem_start events", () => {
    it("should call onProblemStart with all parameters", async () => {
      const onProblemStart = vi.fn();
      const response = createSSEResponse([
        sseEvent("problem_start", {
          problemIndex: 2,
          problemNumber: 5,
          currentIndex: 2,
          totalProblems: 10,
        }),
      ]);

      await parseSSEStream(response, { onProblemStart });

      expect(onProblemStart).toHaveBeenCalledWith(2, 5, 2, 10);
    });
  });

  describe("problem_complete events", () => {
    it("should call onProblemComplete with result", async () => {
      const onProblemComplete = vi.fn();
      const result = { terms: [1, 2], correctAnswer: 3 };
      const response = createSSEResponse([
        sseEvent("problem_complete", {
          problemIndex: 0,
          problemNumber: 1,
          result,
          currentIndex: 0,
          totalProblems: 5,
        }),
      ]);

      await parseSSEStream(response, { onProblemComplete });

      expect(onProblemComplete).toHaveBeenCalledWith(0, 1, result, 0, 5);
    });
  });

  describe("problem_error events", () => {
    it("should call onProblemError with message", async () => {
      const onProblemError = vi.fn();
      const response = createSSEResponse([
        sseEvent("problem_error", {
          problemIndex: 3,
          message: "Failed to parse problem",
        }),
      ]);

      await parseSSEStream(response, { onProblemError });

      expect(onProblemError).toHaveBeenCalledWith(3, "Failed to parse problem");
    });
  });

  describe("complete events", () => {
    it("should call onComplete with result and stats", async () => {
      const onComplete = vi.fn();
      const result = {
        problems: [],
        pageMetadata: { lessonId: null, weekId: null, detectedFormat: "vertical" },
        overallConfidence: 0.95,
        warnings: [],
        needsReview: false,
      };
      const stats = {
        totalProblems: 10,
        correctCount: 8,
        incorrectCount: 2,
        unansweredCount: 0,
        accuracy: 0.8,
        skillsDetected: ["addition"],
      };
      const response = createSSEResponse([
        sseEvent("complete", { result, stats, status: "approved" }),
      ]);

      await parseSSEStream(response, { onComplete });

      expect(onComplete).toHaveBeenCalledWith(result, stats, "approved");
    });

    it("should handle updatedResult for re-parse complete", async () => {
      const onComplete = vi.fn();
      const updatedResult = {
        problems: [{ problemNumber: 1 }],
        pageMetadata: { lessonId: null, weekId: null, detectedFormat: "vertical" },
        overallConfidence: 0.9,
        warnings: [],
        needsReview: false,
      };
      const response = createSSEResponse([
        sseEvent("complete", { updatedResult, status: "needs_review" }),
      ]);

      await parseSSEStream(response, { onComplete });

      expect(onComplete).toHaveBeenCalledWith(updatedResult, undefined, "needs_review");
    });
  });

  describe("error events", () => {
    it("should call onError with message and code", async () => {
      const onError = vi.fn();
      const response = createSSEResponse([
        sseEvent("error", { message: "API rate limit exceeded", code: "RATE_LIMIT" }),
      ]);

      await parseSSEStream(response, { onError });

      expect(onError).toHaveBeenCalledWith("API rate limit exceeded", "RATE_LIMIT");
    });
  });

  describe("cancelled events", () => {
    it("should call onCancelled", async () => {
      const onCancelled = vi.fn();
      const response = createSSEResponse([sseEvent("cancelled", {})]);

      await parseSSEStream(response, { onCancelled });

      expect(onCancelled).toHaveBeenCalled();
    });
  });

  describe("abort signal handling", () => {
    it("should call onCancelled when aborted", async () => {
      const onCancelled = vi.fn();
      const controller = new AbortController();

      // Create a stream that doesn't close immediately
      const stream = new ReadableStream({
        async start(streamController) {
          // Abort before any data
          controller.abort();
          streamController.close();
        },
      });
      const response = new Response(stream);

      await parseSSEStream(response, { onCancelled }, controller.signal);

      expect(onCancelled).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should throw error when response has no body", async () => {
      const response = new Response(null);

      await expect(parseSSEStream(response, {})).rejects.toThrow("No response body");
    });

    it("should skip [DONE] markers", async () => {
      const onComplete = vi.fn();
      const response = createSSEResponse([
        "data: [DONE]",
        sseEvent("complete", { result: { problems: [] } }),
      ]);

      await parseSSEStream(response, { onComplete });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("should handle malformed JSON gracefully", async () => {
      const onError = vi.fn();
      const response = createSSEResponse([
        "data: {invalid json",
        sseEvent("error", { message: "Test error" }),
      ]);

      await parseSSEStream(response, { onError });

      // Should still process the valid event
      expect(onError).toHaveBeenCalledWith("Test error", "");
    });

    it("should handle multiple events in sequence", async () => {
      const callbacks: SSECallbacks = {
        onStarted: vi.fn(),
        onProgress: vi.fn(),
        onReasoning: vi.fn(),
        onComplete: vi.fn(),
      };

      const response = createSSEResponse([
        sseEvent("started", { responseId: "resp-1" }),
        sseEvent("progress", { message: "Step 1" }),
        sseEvent("reasoning", { text: "Thinking...", isDelta: true }),
        sseEvent("complete", { result: { problems: [] } }),
      ]);

      await parseSSEStream(response, callbacks);

      expect(callbacks.onStarted).toHaveBeenCalledWith("resp-1");
      expect(callbacks.onProgress).toHaveBeenCalledWith("Step 1");
      expect(callbacks.onReasoning).toHaveBeenCalledWith("Thinking...", true, undefined);
      expect(callbacks.onComplete).toHaveBeenCalled();
    });
  });
});

describe("extractCompletedProblemsFromPartialJson", () => {
  it("should return empty array when no problems array found", () => {
    const result = extractCompletedProblemsFromPartialJson('{"key": "value"}');
    expect(result).toEqual([]);
  });

  it("should return empty array for empty problems array", () => {
    const result = extractCompletedProblemsFromPartialJson('{"problems": []}');
    expect(result).toEqual([]);
  });

  it("should extract a single complete problem", () => {
    const json = `{"problems": [{"problemNumber": 1, "problemBoundingBox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4}}]}`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      problemNumber: 1,
      problemBoundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    });
  });

  it("should extract multiple complete problems", () => {
    const json = `{"problems": [
      {"problemNumber": 1, "problemBoundingBox": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2}},
      {"problemNumber": 2, "problemBoundingBox": {"x": 0.3, "y": 0.1, "width": 0.2, "height": 0.2}},
      {"problemNumber": 3, "problemBoundingBox": {"x": 0.5, "y": 0.1, "width": 0.2, "height": 0.2}}
    ]}`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toHaveLength(3);
    expect(result[0].problemNumber).toBe(1);
    expect(result[1].problemNumber).toBe(2);
    expect(result[2].problemNumber).toBe(3);
  });

  it("should ignore incomplete problem objects", () => {
    // Partial JSON - last problem is incomplete
    const json = `{"problems": [
      {"problemNumber": 1, "problemBoundingBox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4}},
      {"problemNumber": 2, "problemBounding`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toHaveLength(1);
    expect(result[0].problemNumber).toBe(1);
  });

  it("should handle problems with additional fields", () => {
    const json = `{"problems": [{"problemNumber": 5, "terms": [10, 20], "correctAnswer": 30, "studentAnswer": 30, "problemBoundingBox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4}, "answerBoundingBox": {"x": 0.2, "y": 0.3, "width": 0.1, "height": 0.1}}]}`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toHaveLength(1);
    expect(result[0].problemNumber).toBe(5);
    expect(result[0].problemBoundingBox).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
  });

  it("should handle strings with special characters", () => {
    // Problem with a warning string containing quotes and braces
    const json = `{"problems": [{"problemNumber": 1, "problemBoundingBox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4}, "warning": "Contains \\"special\\" {chars}"}]}`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toHaveLength(1);
    expect(result[0].problemNumber).toBe(1);
  });

  it("should handle escaped backslashes in strings", () => {
    const json = `{"problems": [{"problemNumber": 1, "problemBoundingBox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4}, "path": "C:\\\\Users\\\\test"}]}`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toHaveLength(1);
    expect(result[0].problemNumber).toBe(1);
  });

  it("should reject objects without problemNumber", () => {
    const json = `{"problems": [{"problemBoundingBox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4}}]}`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toEqual([]);
  });

  it("should reject objects without valid problemBoundingBox", () => {
    const json = `{"problems": [{"problemNumber": 1, "problemBoundingBox": null}]}`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toEqual([]);
  });

  it("should reject objects with invalid bounding box structure", () => {
    const json = `{"problems": [{"problemNumber": 1, "problemBoundingBox": {"x": "invalid"}}]}`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toEqual([]);
  });

  it("should handle whitespace variations", () => {
    const json = `{  "problems"  :  [  { "problemNumber" : 1 , "problemBoundingBox" : { "x" : 0.1 , "y" : 0.2 , "width" : 0.3 , "height" : 0.4 } }  ]  }`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toHaveLength(1);
    expect(result[0].problemNumber).toBe(1);
  });

  it("should handle nested objects within problems", () => {
    const json = `{"problems": [{"problemNumber": 1, "problemBoundingBox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4}, "metadata": {"nested": {"deep": true}}}]}`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toHaveLength(1);
    expect(result[0].problemNumber).toBe(1);
  });

  it("should stop at end of problems array", () => {
    const json = `{"problems": [{"problemNumber": 1, "problemBoundingBox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4}}], "otherArray": [{"problemNumber": 2, "problemBoundingBox": {"x": 0.5, "y": 0.5, "width": 0.1, "height": 0.1}}]}`;
    const result = extractCompletedProblemsFromPartialJson(json);

    expect(result).toHaveLength(1);
    expect(result[0].problemNumber).toBe(1);
  });
});
