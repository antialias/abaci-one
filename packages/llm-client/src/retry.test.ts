import { describe, it, expect, vi } from "vitest";
import {
  executeWithRetry,
  buildFeedbackPrompt,
  isRetryableError,
  getRetryDelay,
} from "./retry";
import {
  LLMValidationError,
  LLMApiError,
  LLMTruncationError,
  LLMContentFilterError,
  LLMJsonParseError,
} from "./types";
import type { ValidationFeedback, LLMProgress } from "./types";

describe("retry", () => {
  describe("isRetryableError", () => {
    it("should return false for LLMContentFilterError", () => {
      const error = new LLMContentFilterError("openai", "Content was filtered");
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for LLMTruncationError", () => {
      const error = new LLMTruncationError("openai", { partial: "data" });
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return true for LLMValidationError", () => {
      const error = new LLMValidationError({ field: "test", error: "invalid" });
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for LLMJsonParseError", () => {
      const error = new LLMJsonParseError("not json", "Unexpected token");
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for rate limit errors (429)", () => {
      const error = new LLMApiError("openai", 429, "Rate limited");
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for server errors (5xx)", () => {
      const error500 = new LLMApiError("openai", 500, "Internal error");
      const error502 = new LLMApiError("openai", 502, "Bad gateway");
      const error503 = new LLMApiError("openai", 503, "Service unavailable");
      expect(isRetryableError(error500)).toBe(true);
      expect(isRetryableError(error502)).toBe(true);
      expect(isRetryableError(error503)).toBe(true);
    });

    it("should return false for client errors (4xx except 429)", () => {
      const error400 = new LLMApiError("openai", 400, "Bad request");
      const error401 = new LLMApiError("openai", 401, "Unauthorized");
      const error403 = new LLMApiError("openai", 403, "Forbidden");
      const error404 = new LLMApiError("openai", 404, "Not found");
      expect(isRetryableError(error400)).toBe(false);
      expect(isRetryableError(error401)).toBe(false);
      expect(isRetryableError(error403)).toBe(false);
      expect(isRetryableError(error404)).toBe(false);
    });

    it("should return true for generic errors (network issues)", () => {
      const error = new Error("Network error");
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe("getRetryDelay", () => {
    it("should use Retry-After from LLMApiError when available", () => {
      const error = new LLMApiError("openai", 429, "Rate limited", 5000);
      const delay = getRetryDelay(error, 1, 1000, 60000);
      expect(delay).toBe(5000);
    });

    it("should cap Retry-After at maxDelayMs", () => {
      const error = new LLMApiError("openai", 429, "Rate limited", 120000);
      const delay = getRetryDelay(error, 1, 1000, 60000);
      expect(delay).toBe(60000);
    });

    it("should use exponential backoff without Retry-After", () => {
      const delay1 = getRetryDelay(null, 1, 1000, 60000);
      const delay2 = getRetryDelay(null, 2, 1000, 60000);
      const delay3 = getRetryDelay(null, 3, 1000, 60000);

      // Should roughly double each time (with jitter)
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThan(1200); // 10% jitter max
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThan(2400);
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThan(4800);
    });

    it("should cap exponential backoff at maxDelayMs", () => {
      const delay = getRetryDelay(null, 10, 1000, 5000);
      expect(delay).toBe(5000);
    });
  });

  describe("executeWithRetry", () => {
    it("should succeed on first attempt when validation passes", async () => {
      const fn = vi.fn().mockResolvedValue({ value: 42 });
      const validate = vi.fn().mockReturnValue(null);

      const result = await executeWithRetry(fn, validate, { maxRetries: 2 });

      expect(result.result).toEqual({ value: 42 });
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(undefined);
      expect(validate).toHaveBeenCalledTimes(1);
    });

    it("should retry and succeed when validation fails then passes", async () => {
      const validationError: ValidationFeedback = {
        field: "value",
        error: "must be positive",
        received: -1,
      };

      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({ value: callCount === 1 ? -1 : 42 });
      });

      const validate = vi.fn().mockImplementation((result) => {
        if (result.value < 0) {
          return validationError;
        }
        return null;
      });

      const result = await executeWithRetry(fn, validate, {
        maxRetries: 2,
        baseDelayMs: 10,
      });

      expect(result.result).toEqual({ value: 42 });
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith(validationError);
    });

    it("should throw LLMValidationError after max retries", async () => {
      const validationError: ValidationFeedback = {
        field: "value",
        error: "always invalid",
      };

      const fn = vi.fn().mockResolvedValue({ value: "bad" });
      const validate = vi.fn().mockReturnValue(validationError);

      await expect(
        executeWithRetry(fn, validate, { maxRetries: 2, baseDelayMs: 10 }),
      ).rejects.toThrow(LLMValidationError);

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should include validation error in thrown LLMValidationError", async () => {
      const validationError: ValidationFeedback = {
        field: "items.0.price",
        error: "Expected number, received string",
        received: "free",
        expected: "number",
      };

      const fn = vi.fn().mockResolvedValue({});
      const validate = vi.fn().mockReturnValue(validationError);

      try {
        await executeWithRetry(fn, validate, {
          maxRetries: 1,
          baseDelayMs: 10,
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(LLMValidationError);
        const llmError = error as LLMValidationError;
        expect(llmError.feedback).toEqual(validationError);
        expect(llmError.message).toContain("items.0.price");
      }
    });

    it("should retry on server errors", async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new LLMApiError("openai", 500, "Server error"));
        }
        return Promise.resolve({ value: "success" });
      });

      const validate = vi.fn().mockReturnValue(null);

      const result = await executeWithRetry(fn, validate, {
        maxRetries: 2,
        baseDelayMs: 10,
      });

      expect(result.result).toEqual({ value: "success" });
      expect(result.attempts).toBe(2);
    });

    it("should retry on rate limit errors", async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(
            new LLMApiError("openai", 429, "Rate limited", 100),
          );
        }
        return Promise.resolve({ value: "success" });
      });

      const validate = vi.fn().mockReturnValue(null);

      const result = await executeWithRetry(fn, validate, {
        maxRetries: 2,
        baseDelayMs: 10,
      });

      expect(result.result).toEqual({ value: "success" });
      expect(result.attempts).toBe(2);
    });

    it("should NOT retry on content filter errors", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          new LLMContentFilterError("openai", "Content was filtered"),
        );
      const validate = vi.fn();

      await expect(
        executeWithRetry(fn, validate, { maxRetries: 2, baseDelayMs: 10 }),
      ).rejects.toThrow(LLMContentFilterError);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry on truncation errors", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          new LLMTruncationError("openai", { partial: "data" }),
        );
      const validate = vi.fn();

      await expect(
        executeWithRetry(fn, validate, { maxRetries: 2, baseDelayMs: 10 }),
      ).rejects.toThrow(LLMTruncationError);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry on client errors (4xx)", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new LLMApiError("openai", 400, "Bad request"));
      const validate = vi.fn();

      await expect(
        executeWithRetry(fn, validate, { maxRetries: 2, baseDelayMs: 10 }),
      ).rejects.toThrow(LLMApiError);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on JSON parse errors and include feedback", async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation((feedback) => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(
            new LLMJsonParseError("not json {", "Unexpected end"),
          );
        }
        // On retry, feedback should be set
        expect(feedback).toBeDefined();
        expect(feedback?.field).toBe("root");
        expect(feedback?.error).toContain("not valid JSON");
        return Promise.resolve({ value: "success" });
      });

      const validate = vi.fn().mockReturnValue(null);

      const result = await executeWithRetry(fn, validate, {
        maxRetries: 2,
        baseDelayMs: 10,
      });

      expect(result.result).toEqual({ value: "success" });
      expect(result.attempts).toBe(2);
    });

    it("should throw API error after max retries", async () => {
      const apiError = new LLMApiError("openai", 500, "API is down");
      const fn = vi.fn().mockRejectedValue(apiError);
      const validate = vi.fn();

      await expect(
        executeWithRetry(fn, validate, { maxRetries: 2, baseDelayMs: 10 }),
      ).rejects.toThrow("API is down");

      expect(fn).toHaveBeenCalledTimes(3);
      expect(validate).not.toHaveBeenCalled();
    });

    it("should call onProgress at each stage", async () => {
      const progressCalls: LLMProgress[] = [];
      const onProgress = vi.fn((progress: LLMProgress) => {
        progressCalls.push({ ...progress });
      });

      const fn = vi.fn().mockResolvedValue({ value: 42 });
      const validate = vi.fn().mockReturnValue(null);

      await executeWithRetry(fn, validate, {
        maxRetries: 2,
        onProgress,
      });

      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0].stage).toBe("calling");
      expect(progressCalls[0].attempt).toBe(1);
      expect(progressCalls[0].maxAttempts).toBe(3);
      expect(progressCalls[0].message).toBe("Calling LLM...");
      expect(progressCalls[1].stage).toBe("validating");
      expect(progressCalls[1].attempt).toBe(1);
    });

    it("should call onProgress with retry stage on validation failure", async () => {
      const progressCalls: LLMProgress[] = [];
      const onProgress = vi.fn((progress: LLMProgress) => {
        progressCalls.push({ ...progress });
      });

      const validationError: ValidationFeedback = {
        field: "name",
        error: "too short",
      };

      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({ name: callCount === 1 ? "a" : "valid" });
      });

      const validate = vi.fn().mockImplementation((result) => {
        if (result.name.length < 2) return validationError;
        return null;
      });

      await executeWithRetry(fn, validate, {
        maxRetries: 2,
        baseDelayMs: 10,
        onProgress,
      });

      expect(progressCalls).toHaveLength(4);
      expect(progressCalls[0].stage).toBe("calling");
      expect(progressCalls[1].stage).toBe("validating");
      expect(progressCalls[2].stage).toBe("retrying");
      expect(progressCalls[2].message).toContain("Retry 1/2");
      expect(progressCalls[2].message).toContain("name");
      expect(progressCalls[2].validationError).toEqual(validationError);
      expect(progressCalls[3].stage).toBe("validating");
    });

    it("should not throw LLMValidationError as API error", async () => {
      const validationError: ValidationFeedback = {
        field: "test",
        error: "invalid",
      };

      const fn = vi.fn().mockResolvedValue({});
      const validate = vi.fn().mockReturnValue(validationError);

      await expect(
        executeWithRetry(fn, validate, { maxRetries: 0, baseDelayMs: 10 }),
      ).rejects.toThrow(LLMValidationError);
    });

    it("should respect maxDelayMs option", async () => {
      const startTime = Date.now();
      let callCount = 0;

      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new LLMApiError("openai", 500, "Error"));
        }
        return Promise.resolve({ value: "success" });
      });

      const validate = vi.fn().mockReturnValue(null);

      await executeWithRetry(fn, validate, {
        maxRetries: 3,
        baseDelayMs: 10,
        maxDelayMs: 50,
      });

      const elapsed = Date.now() - startTime;
      // With maxDelayMs of 50ms and 2 retries, total delay should be under 200ms
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe("buildFeedbackPrompt", () => {
    it("should build basic feedback prompt", () => {
      const feedback: ValidationFeedback = {
        field: "sentiment",
        error: "Invalid enum value",
      };

      const prompt = buildFeedbackPrompt(feedback);

      expect(prompt).toContain("PREVIOUS ATTEMPT HAD VALIDATION ERROR");
      expect(prompt).toContain("Field: sentiment");
      expect(prompt).toContain("Error: Invalid enum value");
      expect(prompt).toContain("Please correct this error");
    });

    it("should include received value when provided", () => {
      const feedback: ValidationFeedback = {
        field: "count",
        error: "Expected number",
        received: "five",
      };

      const prompt = buildFeedbackPrompt(feedback);

      expect(prompt).toContain('Received: "five"');
    });

    it("should include expected value when provided", () => {
      const feedback: ValidationFeedback = {
        field: "type",
        error: "Wrong type",
        expected: "number",
      };

      const prompt = buildFeedbackPrompt(feedback);

      expect(prompt).toContain('Expected: "number"');
    });

    it("should include valid options when provided", () => {
      const feedback: ValidationFeedback = {
        field: "status",
        error: "Invalid enum value",
        validOptions: ["pending", "active", "completed"],
      };

      const prompt = buildFeedbackPrompt(feedback);

      expect(prompt).toContain("Valid options: pending, active, completed");
    });

    it("should include all fields when fully specified", () => {
      const feedback: ValidationFeedback = {
        field: "items.0.status",
        error: "Invalid status value",
        received: "unknown",
        expected: "one of the valid options",
        validOptions: ["draft", "published", "archived"],
      };

      const prompt = buildFeedbackPrompt(feedback);

      expect(prompt).toContain("Field: items.0.status");
      expect(prompt).toContain("Error: Invalid status value");
      expect(prompt).toContain('Received: "unknown"');
      expect(prompt).toContain('Expected: "one of the valid options"');
      expect(prompt).toContain("Valid options: draft, published, archived");
    });

    it("should handle empty validOptions array", () => {
      const feedback: ValidationFeedback = {
        field: "test",
        error: "error",
        validOptions: [],
      };

      const prompt = buildFeedbackPrompt(feedback);

      expect(prompt).not.toContain("Valid options:");
    });

    it("should handle complex received values", () => {
      const feedback: ValidationFeedback = {
        field: "data",
        error: "Invalid structure",
        received: { nested: { value: [1, 2, 3] } },
      };

      const prompt = buildFeedbackPrompt(feedback);

      expect(prompt).toContain('Received: {"nested":{"value":[1,2,3]}}');
    });
  });
});

describe("LLMApiError", () => {
  describe("isRateLimited", () => {
    it("should return true for 429", () => {
      const error = new LLMApiError("openai", 429, "Rate limited");
      expect(error.isRateLimited()).toBe(true);
    });

    it("should return false for other status codes", () => {
      expect(new LLMApiError("openai", 400, "Bad").isRateLimited()).toBe(false);
      expect(new LLMApiError("openai", 500, "Error").isRateLimited()).toBe(
        false,
      );
    });
  });

  describe("isServerError", () => {
    it("should return true for 5xx errors", () => {
      expect(new LLMApiError("openai", 500, "Error").isServerError()).toBe(
        true,
      );
      expect(new LLMApiError("openai", 502, "Error").isServerError()).toBe(
        true,
      );
      expect(new LLMApiError("openai", 503, "Error").isServerError()).toBe(
        true,
      );
      expect(new LLMApiError("openai", 599, "Error").isServerError()).toBe(
        true,
      );
    });

    it("should return false for non-5xx errors", () => {
      expect(new LLMApiError("openai", 400, "Error").isServerError()).toBe(
        false,
      );
      expect(new LLMApiError("openai", 429, "Error").isServerError()).toBe(
        false,
      );
      expect(new LLMApiError("openai", 600, "Error").isServerError()).toBe(
        false,
      );
    });
  });

  describe("isClientError", () => {
    it("should return true for 4xx errors except 429", () => {
      expect(new LLMApiError("openai", 400, "Error").isClientError()).toBe(
        true,
      );
      expect(new LLMApiError("openai", 401, "Error").isClientError()).toBe(
        true,
      );
      expect(new LLMApiError("openai", 403, "Error").isClientError()).toBe(
        true,
      );
      expect(new LLMApiError("openai", 404, "Error").isClientError()).toBe(
        true,
      );
    });

    it("should return false for 429 (rate limit)", () => {
      expect(new LLMApiError("openai", 429, "Error").isClientError()).toBe(
        false,
      );
    });

    it("should return false for non-4xx errors", () => {
      expect(new LLMApiError("openai", 500, "Error").isClientError()).toBe(
        false,
      );
      expect(new LLMApiError("openai", 200, "Error").isClientError()).toBe(
        false,
      );
    });
  });

  describe("retryAfterMs", () => {
    it("should store retry-after value", () => {
      const error = new LLMApiError("openai", 429, "Rate limited", 5000);
      expect(error.retryAfterMs).toBe(5000);
    });

    it("should be undefined when not provided", () => {
      const error = new LLMApiError("openai", 429, "Rate limited");
      expect(error.retryAfterMs).toBeUndefined();
    });
  });
});

describe("Error types", () => {
  describe("LLMTruncationError", () => {
    it("should store partial content", () => {
      const error = new LLMTruncationError("openai", { partial: "data" });
      expect(error.partialContent).toEqual({ partial: "data" });
      expect(error.provider).toBe("openai");
      expect(error.message).toContain("truncated");
    });
  });

  describe("LLMContentFilterError", () => {
    it("should store filter reason", () => {
      const error = new LLMContentFilterError(
        "openai",
        "Harmful content detected",
      );
      expect(error.filterReason).toBe("Harmful content detected");
      expect(error.provider).toBe("openai");
      expect(error.message).toContain("content filter");
    });

    it("should handle missing filter reason", () => {
      const error = new LLMContentFilterError("openai");
      expect(error.filterReason).toBeUndefined();
      expect(error.message).toContain("content filter");
    });
  });

  describe("LLMJsonParseError", () => {
    it("should store raw content and parse error", () => {
      const error = new LLMJsonParseError("not json {", "Unexpected token");
      expect(error.rawContent).toBe("not json {");
      expect(error.parseError).toBe("Unexpected token");
      expect(error.message).toContain("Failed to parse");
    });
  });

  describe("LLMValidationError", () => {
    it("should store validation feedback", () => {
      const feedback: ValidationFeedback = {
        field: "test.field",
        error: "Invalid value",
      };
      const error = new LLMValidationError(feedback);
      expect(error.feedback).toEqual(feedback);
      expect(error.message).toContain("test.field");
      expect(error.message).toContain("Invalid value");
    });
  });
});
