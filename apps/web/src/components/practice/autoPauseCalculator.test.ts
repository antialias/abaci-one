/**
 * Tests for auto-pause threshold calculation utilities
 */
import { describe, expect, it } from "vitest";
import type { SlotResult } from "@/db/schema/session-plans";
import {
  calculateResponseTimeStats,
  calculateAutoPauseInfo,
  getAutoPauseExplanation,
  formatMs,
  DEFAULT_PAUSE_TIMEOUT_MS,
  MIN_SAMPLES_FOR_STATISTICS,
  MIN_PAUSE_THRESHOLD_MS,
  MAX_PAUSE_THRESHOLD_MS,
} from "./autoPauseCalculator";

// Helper to create mock SlotResult with only responseTimeMs
function mockResult(responseTimeMs: number): SlotResult {
  return {
    partNumber: 1,
    slotIndex: 0,
    problem: { terms: [1, 2], answer: 3, skillsRequired: [] },
    studentAnswer: 3,
    isCorrect: true,
    responseTimeMs,
    skillsExercised: [],
    usedOnScreenAbacus: false,
    timestamp: new Date(),
    hadHelp: false,
    incorrectAttempts: 0,
  };
}

describe("autoPauseCalculator", () => {
  describe("formatMs", () => {
    it("formats milliseconds less than 60s as seconds", () => {
      expect(formatMs(1000)).toBe("1.0s");
      expect(formatMs(1500)).toBe("1.5s");
      expect(formatMs(30000)).toBe("30.0s");
      expect(formatMs(59999)).toBe("60.0s"); // Just under 60s
    });

    it("formats milliseconds >= 60s as minutes", () => {
      expect(formatMs(60000)).toBe("1.0m");
      expect(formatMs(90000)).toBe("1.5m");
      expect(formatMs(120000)).toBe("2.0m");
      expect(formatMs(300000)).toBe("5.0m");
    });

    it("handles edge cases", () => {
      expect(formatMs(0)).toBe("0.0s");
      expect(formatMs(100)).toBe("0.1s");
      expect(formatMs(59999)).toBe("60.0s");
      expect(formatMs(60000)).toBe("1.0m");
    });
  });

  describe("calculateResponseTimeStats", () => {
    it("returns zeros for empty array", () => {
      const stats = calculateResponseTimeStats([]);
      expect(stats).toEqual({ mean: 0, stdDev: 0, count: 0 });
    });

    it("calculates mean correctly for single sample", () => {
      const stats = calculateResponseTimeStats([mockResult(5000)]);
      expect(stats.mean).toBe(5000);
      expect(stats.stdDev).toBe(0);
      expect(stats.count).toBe(1);
    });

    it("calculates mean correctly for multiple samples", () => {
      const results = [
        mockResult(1000),
        mockResult(2000),
        mockResult(3000),
        mockResult(4000),
        mockResult(5000),
      ];
      const stats = calculateResponseTimeStats(results);
      expect(stats.mean).toBe(3000); // (1+2+3+4+5)/5 = 3
      expect(stats.count).toBe(5);
    });

    it("calculates sample standard deviation correctly", () => {
      // Values: 2000, 4000, 4000, 4000, 5000, 5000, 7000, 9000
      // Mean: 5000
      // Sample variance: sum of (x-mean)^2 / (n-1)
      const results = [
        mockResult(2000),
        mockResult(4000),
        mockResult(4000),
        mockResult(4000),
        mockResult(5000),
        mockResult(5000),
        mockResult(7000),
        mockResult(9000),
      ];
      const stats = calculateResponseTimeStats(results);
      expect(stats.mean).toBe(5000);
      expect(stats.count).toBe(8);
      // Expected stdDev: sqrt(32000000/7) ≈ 2138.09
      expect(stats.stdDev).toBeCloseTo(2138.09, 0);
    });

    it("uses sample standard deviation (n-1 denominator)", () => {
      // Two samples: 0, 10000 - mean = 5000
      // Sample variance = (5000^2 + 5000^2) / 1 = 50000000
      // Sample stdDev = sqrt(50000000) ≈ 7071.07
      const results = [mockResult(0), mockResult(10000)];
      const stats = calculateResponseTimeStats(results);
      expect(stats.mean).toBe(5000);
      expect(stats.stdDev).toBeCloseTo(7071.07, 0);
    });
  });

  describe("calculateAutoPauseInfo", () => {
    it("uses default timeout with fewer than 5 samples", () => {
      const results = [
        mockResult(3000),
        mockResult(4000),
        mockResult(5000),
        mockResult(6000),
      ];
      const { threshold, stats } = calculateAutoPauseInfo(results);

      expect(threshold).toBe(DEFAULT_PAUSE_TIMEOUT_MS);
      expect(stats.usedStatistics).toBe(false);
      expect(stats.sampleCount).toBe(4);
    });

    it("uses default timeout with 0 samples", () => {
      const { threshold, stats } = calculateAutoPauseInfo([]);

      expect(threshold).toBe(DEFAULT_PAUSE_TIMEOUT_MS);
      expect(stats.usedStatistics).toBe(false);
      expect(stats.sampleCount).toBe(0);
    });

    it("uses statistical calculation with 5+ samples", () => {
      const results = [
        mockResult(3000),
        mockResult(4000),
        mockResult(5000),
        mockResult(6000),
        mockResult(7000),
      ];
      const { stats } = calculateAutoPauseInfo(results);

      expect(stats.usedStatistics).toBe(true);
      expect(stats.sampleCount).toBe(5);
    });

    it("calculates threshold as mean + 2*stdDev", () => {
      // Create samples where we know the expected stats
      // All same value = stdDev of 0, threshold = mean
      const results = Array(10)
        .fill(null)
        .map(() => mockResult(60000)); // All 60s

      const { threshold, stats } = calculateAutoPauseInfo(results);

      expect(stats.meanMs).toBe(60000);
      expect(stats.stdDevMs).toBe(0);
      // 60000 + 2*0 = 60000, but clamped to max 30s min
      expect(threshold).toBe(60000);
    });

    it("clamps threshold to minimum 30 seconds", () => {
      // Very fast response times
      const results = Array(10)
        .fill(null)
        .map(() => mockResult(1000)); // All 1s

      const { threshold, stats } = calculateAutoPauseInfo(results);

      expect(stats.meanMs).toBe(1000);
      expect(stats.stdDevMs).toBe(0);
      // 1000 + 2*0 = 1000, clamped to 30000
      expect(threshold).toBe(MIN_PAUSE_THRESHOLD_MS);
    });

    it("clamps threshold to maximum 5 minutes", () => {
      // Very slow and variable response times
      const results = [
        mockResult(200000), // 200s
        mockResult(250000), // 250s
        mockResult(300000), // 300s
        mockResult(350000), // 350s
        mockResult(400000), // 400s
      ];

      const { threshold, stats } = calculateAutoPauseInfo(results);

      expect(stats.usedStatistics).toBe(true);
      // Raw threshold would be way over 5 min
      expect(threshold).toBe(MAX_PAUSE_THRESHOLD_MS);
    });

    it("returns threshold within valid range for typical response times", () => {
      // Simulate typical student: 3-8 second responses
      const results = [
        mockResult(3000),
        mockResult(4500),
        mockResult(5000),
        mockResult(6000),
        mockResult(8000),
        mockResult(4000),
        mockResult(5500),
      ];

      const { threshold, stats } = calculateAutoPauseInfo(results);

      expect(stats.usedStatistics).toBe(true);
      expect(threshold).toBeGreaterThanOrEqual(MIN_PAUSE_THRESHOLD_MS);
      expect(threshold).toBeLessThanOrEqual(MAX_PAUSE_THRESHOLD_MS);
    });
  });

  describe("getAutoPauseExplanation", () => {
    it("explains default timeout when statistics not used", () => {
      const stats = {
        meanMs: 5000,
        stdDevMs: 1000,
        thresholdMs: DEFAULT_PAUSE_TIMEOUT_MS,
        sampleCount: 3,
        usedStatistics: false,
      };

      const explanation = getAutoPauseExplanation(stats);

      expect(explanation).toContain("Default timeout");
      expect(explanation).toContain("5.0m");
      expect(explanation).toContain(`${MIN_SAMPLES_FOR_STATISTICS}+`);
    });

    it("explains statistical calculation without clamping", () => {
      const stats = {
        meanMs: 30000,
        stdDevMs: 10000,
        thresholdMs: 50000, // mean + 2*stdDev = 50000
        sampleCount: 10,
        usedStatistics: true,
      };

      const explanation = getAutoPauseExplanation(stats);

      expect(explanation).toContain("mean (30.0s)");
      expect(explanation).toContain("2×stdDev (10.0s)");
      expect(explanation).toContain("50.0s");
      expect(explanation).not.toContain("clamped");
    });

    it("explains when threshold is clamped to minimum", () => {
      const stats = {
        meanMs: 5000,
        stdDevMs: 1000,
        thresholdMs: MIN_PAUSE_THRESHOLD_MS, // Clamped to 30s
        sampleCount: 10,
        usedStatistics: true,
      };

      const explanation = getAutoPauseExplanation(stats);

      expect(explanation).toContain("clamped");
      expect(explanation).toContain("30.0s");
    });

    it("explains when threshold is clamped to maximum", () => {
      // Raw threshold: 250000 + 2*100000 = 450000ms (7.5min) > 5min max
      const stats = {
        meanMs: 250000,
        stdDevMs: 100000,
        thresholdMs: MAX_PAUSE_THRESHOLD_MS, // Clamped to 5m
        sampleCount: 10,
        usedStatistics: true,
      };

      const explanation = getAutoPauseExplanation(stats);

      expect(explanation).toContain("clamped");
      expect(explanation).toContain("5.0m");
    });
  });

  describe("constants", () => {
    it("has correct default values", () => {
      expect(DEFAULT_PAUSE_TIMEOUT_MS).toBe(5 * 60 * 1000); // 5 minutes
      expect(MIN_SAMPLES_FOR_STATISTICS).toBe(5);
      expect(MIN_PAUSE_THRESHOLD_MS).toBe(30_000); // 30 seconds
      expect(MAX_PAUSE_THRESHOLD_MS).toBe(DEFAULT_PAUSE_TIMEOUT_MS); // 5 minutes
    });
  });
});
