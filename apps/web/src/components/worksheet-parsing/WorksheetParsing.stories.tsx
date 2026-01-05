/**
 * Worksheet Parsing Stories
 *
 * Self-contained test stories for the worksheet parsing feature flow.
 * Uses actual worksheet images and parsing data - no dev server required.
 *
 * ## Images
 * Real worksheet scans are stored in public/storybook-assets/worksheets/
 * Parsing data is derived from actual LLM results.
 *
 * ## Flow stages covered:
 * 1. Summary screen (WorksheetReviewSummary)
 * 2. Problem review (via openViewer callback)
 * 3. Approve/create session
 *
 * ## Updating test data
 * To update with new scans:
 * 1. Copy new images to public/storybook-assets/worksheets/
 * 2. Update the WORKSHEET_*_URL constants
 * 3. Update the PARSING_RESULT_* objects with new LLM results
 */

import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type {
  WorksheetParsingResult,
  ParsedProblem,
} from "@/lib/worksheet-parsing";
import { css } from "../../../styled-system/css";
import { WorksheetReviewSummary } from "./WorksheetReviewSummary";
import {
  OfflineWorkSection,
  type OfflineAttachment,
} from "../practice/OfflineWorkSection";
import {
  PhotoViewerEditor,
  type PhotoViewerEditorPhoto,
} from "../practice/PhotoViewerEditor";
import { VisualDebugProvider } from "@/contexts/VisualDebugContext";
import { MockWorksheetParsingProvider } from "@/contexts/WorksheetParsingContext.mock";

// Create a fresh query client for stories
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}

/**
 * Add default values for required fields that may not be in LLM output
 * This allows us to use raw LLM parsing data in stories without manually adding all fields
 */
type RawProblem = Omit<
  ParsedProblem,
  "notes" | "excluded" | "reviewStatus" | "reviewedAt"
> & {
  notes?: string | null;
  excluded?: boolean;
  reviewStatus?: "pending" | "approved" | "corrected" | "flagged";
  reviewedAt?: string | null;
};

function completeProblem(raw: RawProblem): ParsedProblem {
  return {
    ...raw,
    notes: raw.notes ?? null,
    excluded: raw.excluded ?? false,
    reviewStatus: raw.reviewStatus ?? "pending",
    reviewedAt: raw.reviewedAt ?? null,
  };
}

function completeProblems(problems: RawProblem[]): ParsedProblem[] {
  return problems.map(completeProblem);
}

// =============================================================================
// ACTUAL PARSING DATA FROM DEV SERVER
// These are real LLM parsing results - update as needed for testing
// =============================================================================

/**
 * 20-problem worksheet with medium confidence (61%)
 * Attachment ID: txfea3dnh91kb6rmkhtonrwd
 * File: 844ff99e-c7b2-476b-88dd-235243e75003.jpg
 */
const PARSING_RESULT_20_PROBLEMS: WorksheetParsingResult = {
  problems: completeProblems([
    {
      problemNumber: 1,
      row: 1,
      column: 1,
      format: "vertical",
      terms: [57, 52, 14, 5],
      correctAnswer: 128,
      studentAnswer: 100,
      studentAnswerConfidence: 0.85,
      termsConfidence: 0.75,
      problemBoundingBox: { x: 0.03, y: 0.07, width: 0.088, height: 0.18 },
      answerBoundingBox: { x: 0.03, y: 0.205, width: 0.088, height: 0.045 },
    },
    {
      problemNumber: 2,
      row: 1,
      column: 2,
      format: "vertical",
      terms: [94, 65, 5, 14],
      correctAnswer: 178,
      studentAnswer: 150,
      studentAnswerConfidence: 0.85,
      termsConfidence: 0.72,
      problemBoundingBox: { x: 0.124, y: 0.07, width: 0.088, height: 0.18 },
      answerBoundingBox: { x: 0.124, y: 0.205, width: 0.088, height: 0.045 },
    },
    {
      problemNumber: 3,
      row: 1,
      column: 3,
      format: "vertical",
      terms: [91, 19, 1, 10],
      correctAnswer: 121,
      studentAnswer: 99,
      studentAnswerConfidence: 0.8,
      termsConfidence: 0.65,
      problemBoundingBox: { x: 0.218, y: 0.07, width: 0.088, height: 0.18 },
      answerBoundingBox: { x: 0.218, y: 0.205, width: 0.088, height: 0.045 },
    },
    {
      problemNumber: 4,
      row: 1,
      column: 4,
      format: "vertical",
      terms: [29, 47, 80, -50],
      correctAnswer: 106,
      studentAnswer: 106,
      studentAnswerConfidence: 0.8,
      termsConfidence: 0.7,
      problemBoundingBox: { x: 0.312, y: 0.07, width: 0.088, height: 0.18 },
      answerBoundingBox: { x: 0.312, y: 0.205, width: 0.088, height: 0.045 },
    },
    {
      problemNumber: 5,
      row: 1,
      column: 5,
      format: "vertical",
      terms: [53, 72, 35, 41],
      correctAnswer: 201,
      studentAnswer: 149,
      studentAnswerConfidence: 0.7,
      termsConfidence: 0.6,
      problemBoundingBox: { x: 0.406, y: 0.07, width: 0.088, height: 0.18 },
      answerBoundingBox: { x: 0.406, y: 0.205, width: 0.088, height: 0.045 },
    },
    {
      problemNumber: 6,
      row: 1,
      column: 6,
      format: "vertical",
      terms: [12, 43, 5, 11],
      correctAnswer: 71,
      studentAnswer: 49,
      studentAnswerConfidence: 0.8,
      termsConfidence: 0.65,
      problemBoundingBox: { x: 0.5, y: 0.07, width: 0.088, height: 0.18 },
      answerBoundingBox: { x: 0.5, y: 0.205, width: 0.088, height: 0.045 },
    },
    {
      problemNumber: 7,
      row: 1,
      column: 7,
      format: "vertical",
      terms: [76, 34, 1, 90],
      correctAnswer: 201,
      studentAnswer: 19,
      studentAnswerConfidence: 0.75,
      termsConfidence: 0.55,
      problemBoundingBox: { x: 0.594, y: 0.07, width: 0.088, height: 0.18 },
      answerBoundingBox: { x: 0.594, y: 0.205, width: 0.088, height: 0.045 },
    },
    {
      problemNumber: 8,
      row: 1,
      column: 8,
      format: "vertical",
      terms: [51, 2, 53, 10],
      correctAnswer: 116,
      studentAnswer: 93,
      studentAnswerConfidence: 0.75,
      termsConfidence: 0.6,
      problemBoundingBox: { x: 0.688, y: 0.07, width: 0.088, height: 0.18 },
      answerBoundingBox: { x: 0.688, y: 0.205, width: 0.088, height: 0.045 },
    },
    {
      problemNumber: 9,
      row: 1,
      column: 9,
      format: "vertical",
      terms: [69, 51, 70, 1],
      correctAnswer: 191,
      studentAnswer: 49,
      studentAnswerConfidence: 0.75,
      termsConfidence: 0.55,
      problemBoundingBox: { x: 0.782, y: 0.07, width: 0.088, height: 0.18 },
      answerBoundingBox: { x: 0.782, y: 0.205, width: 0.088, height: 0.045 },
    },
    {
      problemNumber: 10,
      row: 1,
      column: 10,
      format: "vertical",
      terms: [93, 31, 23, 18],
      correctAnswer: 165,
      studentAnswer: 83,
      studentAnswerConfidence: 0.8,
      termsConfidence: 0.65,
      problemBoundingBox: { x: 0.876, y: 0.07, width: 0.094, height: 0.18 },
      answerBoundingBox: { x: 0.876, y: 0.205, width: 0.094, height: 0.045 },
    },
    {
      problemNumber: 11,
      row: 2,
      column: 1,
      format: "vertical",
      terms: [98, 13, 6, 11, 49],
      correctAnswer: 177,
      studentAnswer: 45,
      studentAnswerConfidence: 0.8,
      termsConfidence: 0.65,
      problemBoundingBox: { x: 0.03, y: 0.285, width: 0.088, height: 0.215 },
      answerBoundingBox: { x: 0.03, y: 0.45, width: 0.088, height: 0.05 },
    },
    {
      problemNumber: 12,
      row: 2,
      column: 2,
      format: "vertical",
      terms: [39, 11, -40, 60, 21],
      correctAnswer: 91,
      studentAnswer: 49,
      studentAnswerConfidence: 0.8,
      termsConfidence: 0.7,
      problemBoundingBox: { x: 0.124, y: 0.285, width: 0.088, height: 0.215 },
      answerBoundingBox: { x: 0.124, y: 0.45, width: 0.088, height: 0.05 },
    },
    {
      problemNumber: 13,
      row: 2,
      column: 3,
      format: "vertical",
      terms: [79, 85, 30, 28, 10],
      correctAnswer: 232,
      studentAnswer: 96,
      studentAnswerConfidence: 0.75,
      termsConfidence: 0.6,
      problemBoundingBox: { x: 0.218, y: 0.285, width: 0.088, height: 0.215 },
      answerBoundingBox: { x: 0.218, y: 0.45, width: 0.088, height: 0.05 },
    },
    {
      problemNumber: 14,
      row: 2,
      column: 4,
      format: "vertical",
      terms: [27, 26, 79, 56, 76],
      correctAnswer: 264,
      studentAnswer: 56,
      studentAnswerConfidence: 0.8,
      termsConfidence: 0.6,
      problemBoundingBox: { x: 0.312, y: 0.285, width: 0.088, height: 0.215 },
      answerBoundingBox: { x: 0.312, y: 0.45, width: 0.088, height: 0.05 },
    },
    {
      problemNumber: 15,
      row: 2,
      column: 5,
      format: "vertical",
      terms: [59, 41, 10, 41, 18],
      correctAnswer: 169,
      studentAnswer: 67,
      studentAnswerConfidence: 0.75,
      termsConfidence: 0.55,
      problemBoundingBox: { x: 0.406, y: 0.285, width: 0.088, height: 0.215 },
      answerBoundingBox: { x: 0.406, y: 0.45, width: 0.088, height: 0.05 },
    },
    {
      problemNumber: 16,
      row: 2,
      column: 6,
      format: "vertical",
      terms: [67, 53, 1, 79, 11],
      correctAnswer: 211,
      studentAnswer: 29,
      studentAnswerConfidence: 0.75,
      termsConfidence: 0.55,
      problemBoundingBox: { x: 0.5, y: 0.285, width: 0.088, height: 0.215 },
      answerBoundingBox: { x: 0.5, y: 0.45, width: 0.088, height: 0.05 },
    },
    {
      problemNumber: 17,
      row: 2,
      column: 7,
      format: "vertical",
      terms: [77, 49, 5, 81, 1],
      correctAnswer: 213,
      studentAnswer: 59,
      studentAnswerConfidence: 0.75,
      termsConfidence: 0.55,
      problemBoundingBox: { x: 0.594, y: 0.285, width: 0.088, height: 0.215 },
      answerBoundingBox: { x: 0.594, y: 0.45, width: 0.088, height: 0.05 },
    },
    {
      problemNumber: 18,
      row: 2,
      column: 8,
      format: "vertical",
      terms: [94, 60, 7, 3, 21],
      correctAnswer: 185,
      studentAnswer: 129,
      studentAnswerConfidence: 0.7,
      termsConfidence: 0.55,
      problemBoundingBox: { x: 0.688, y: 0.285, width: 0.088, height: 0.215 },
      answerBoundingBox: { x: 0.688, y: 0.45, width: 0.088, height: 0.05 },
    },
    {
      problemNumber: 19,
      row: 2,
      column: 9,
      format: "vertical",
      terms: [299, 7, 23, 33, 4],
      correctAnswer: 366,
      studentAnswer: 366,
      studentAnswerConfidence: 0.45,
      termsConfidence: 0.78,
      problemBoundingBox: { x: 0.791, y: 0.256, width: 0.096, height: 0.207 },
      answerBoundingBox: { x: 0.782, y: 0.45, width: 0.088, height: 0.05 },
    },
    {
      problemNumber: 20,
      row: 2,
      column: 10,
      format: "vertical",
      terms: [189, 11, 56, -44, -51],
      correctAnswer: 161,
      studentAnswer: 49,
      studentAnswerConfidence: 0.7,
      termsConfidence: 0.62,
      problemBoundingBox: { x: 0.887, y: 0.268, width: 0.083, height: 0.186 },
      answerBoundingBox: { x: 0.876, y: 0.45, width: 0.094, height: 0.05 },
    },
  ]),
  pageMetadata: {
    lessonId: null,
    weekId: null,
    pageNumber: null,
    detectedFormat: "vertical",
    totalRows: 2,
    problemsPerRow: 10,
  },
  overallConfidence: 0.612,
  warnings: [
    "Image resolution/blur makes several printed terms hard to read with high confidence (notably Row 1 Col 5-9; Row 2 Col 3-10).",
    "Possible minus signs may be missed due to low contrast; only Row 1 Col 4 (-50) and Row 2 Col 2 (-40) are clearly visible.",
    "Several student answers are lightly written/smudged (especially Row 2 Col 9).",
  ],
  needsReview: true,
};

/**
 * 10-problem worksheet with low confidence (35%)
 * Attachment ID: jardy4zk5gn6t52cznmas1iu
 * File: 5b1ab679-7107-468a-a73f-073192e6516d.jpg
 */
const PARSING_RESULT_10_PROBLEMS_LOW_CONF: WorksheetParsingResult = {
  problems: completeProblems([
    {
      problemNumber: 1,
      row: 2,
      column: 1,
      format: "vertical",
      terms: [51, 22, 12, -51],
      correctAnswer: 34,
      studentAnswer: 101,
      studentAnswerConfidence: 0.6,
      termsConfidence: 0.75,
      problemBoundingBox: { x: 0.03, y: 0.26, width: 0.09, height: 0.18 },
      answerBoundingBox: { x: 0.03, y: 0.4, width: 0.09, height: 0.06 },
    },
    {
      problemNumber: 2,
      row: 2,
      column: 2,
      format: "vertical",
      terms: [23, -22, 45, -35],
      correctAnswer: 11,
      studentAnswer: 40,
      studentAnswerConfidence: 0.55,
      termsConfidence: 0.55,
      problemBoundingBox: { x: 0.125, y: 0.26, width: 0.09, height: 0.18 },
      answerBoundingBox: { x: 0.125, y: 0.4, width: 0.09, height: 0.06 },
    },
    {
      problemNumber: 3,
      row: 2,
      column: 3,
      format: "vertical",
      terms: [12, 35, -1, 5],
      correctAnswer: 51,
      studentAnswer: 35,
      studentAnswerConfidence: 0.6,
      termsConfidence: 0.8,
      problemBoundingBox: { x: 0.22, y: 0.26, width: 0.09, height: 0.18 },
      answerBoundingBox: { x: 0.22, y: 0.4, width: 0.09, height: 0.06 },
    },
    {
      problemNumber: 4,
      row: 2,
      column: 4,
      format: "vertical",
      terms: [52, 32, 54, 5],
      correctAnswer: 143,
      studentAnswer: 45,
      studentAnswerConfidence: 0.55,
      termsConfidence: 0.75,
      problemBoundingBox: { x: 0.315, y: 0.26, width: 0.09, height: 0.18 },
      answerBoundingBox: { x: 0.315, y: 0.4, width: 0.09, height: 0.06 },
    },
    {
      problemNumber: 5,
      row: 2,
      column: 5,
      format: "vertical",
      terms: [24, 13, 35, 5],
      correctAnswer: 77,
      studentAnswer: 5,
      studentAnswerConfidence: 0.5,
      termsConfidence: 0.7,
      problemBoundingBox: { x: 0.41, y: 0.26, width: 0.09, height: 0.18 },
      answerBoundingBox: { x: 0.41, y: 0.4, width: 0.09, height: 0.06 },
    },
    {
      problemNumber: 6,
      row: 2,
      column: 6,
      format: "vertical",
      terms: [33, 22, 5, -11],
      correctAnswer: 49,
      studentAnswer: 13,
      studentAnswerConfidence: 0.5,
      termsConfidence: 0.65,
      problemBoundingBox: { x: 0.505, y: 0.26, width: 0.09, height: 0.18 },
      answerBoundingBox: { x: 0.505, y: 0.4, width: 0.09, height: 0.06 },
    },
    {
      problemNumber: 7,
      row: 2,
      column: 7,
      format: "vertical",
      terms: [42, 5, 1, 35],
      correctAnswer: 83,
      studentAnswer: null,
      studentAnswerConfidence: 0,
      termsConfidence: 0.5,
      problemBoundingBox: { x: 0.6, y: 0.26, width: 0.09, height: 0.18 },
      answerBoundingBox: { x: 0.6, y: 0.4, width: 0.09, height: 0.06 },
    },
    {
      problemNumber: 8,
      row: 2,
      column: 8,
      format: "vertical",
      terms: [43, -11, 21, -11],
      correctAnswer: 42,
      studentAnswer: null,
      studentAnswerConfidence: 0,
      termsConfidence: 0.5,
      problemBoundingBox: { x: 0.695, y: 0.26, width: 0.09, height: 0.18 },
      answerBoundingBox: { x: 0.695, y: 0.4, width: 0.09, height: 0.06 },
    },
    {
      problemNumber: 9,
      row: 2,
      column: 9,
      format: "vertical",
      terms: [55, -11, 5, 50],
      correctAnswer: 99,
      studentAnswer: null,
      studentAnswerConfidence: 0,
      termsConfidence: 0.35,
      problemBoundingBox: { x: 0.79, y: 0.26, width: 0.09, height: 0.18 },
      answerBoundingBox: { x: 0.79, y: 0.4, width: 0.09, height: 0.06 },
    },
    {
      problemNumber: 10,
      row: 2,
      column: 10,
      format: "vertical",
      terms: [53, 0, 0, 0],
      correctAnswer: 53,
      studentAnswer: null,
      studentAnswerConfidence: 0,
      termsConfidence: 0.2,
      problemBoundingBox: { x: 0.885, y: 0.26, width: 0.09, height: 0.18 },
      answerBoundingBox: { x: 0.885, y: 0.4, width: 0.09, height: 0.06 },
    },
  ]),
  pageMetadata: {
    lessonId: null,
    weekId: null,
    pageNumber: null,
    detectedFormat: "vertical",
    totalRows: 4,
    problemsPerRow: 10,
  },
  overallConfidence: 0.35,
  warnings: [
    "Image resolution/clarity is too low to reliably read most printed terms across the page.",
    "Only the second row of problems was partially legible; other rows were not transcribed.",
    "Several problems (especially columns 7-10) have low term readability.",
    "Student handwriting in many answer boxes is difficult to read; several answers set to null.",
    "Problem 10 terms are not readable; placeholder zeros were used due to schema requirements—needs manual verification against a clearer image.",
  ],
  needsReview: true,
};

/**
 * 6-problem high confidence worksheet (synthetic for testing good scans)
 */
const PARSING_RESULT_HIGH_CONF: WorksheetParsingResult = {
  problems: completeProblems([
    {
      problemNumber: 1,
      row: 1,
      column: 1,
      format: "vertical",
      terms: [25, 34],
      correctAnswer: 59,
      studentAnswer: 59,
      studentAnswerConfidence: 0.95,
      termsConfidence: 0.92,
      problemBoundingBox: { x: 0.05, y: 0.1, width: 0.12, height: 0.15 },
      answerBoundingBox: { x: 0.05, y: 0.22, width: 0.12, height: 0.05 },
    },
    {
      problemNumber: 2,
      row: 1,
      column: 2,
      format: "vertical",
      terms: [47, 28],
      correctAnswer: 75,
      studentAnswer: 75,
      studentAnswerConfidence: 0.93,
      termsConfidence: 0.9,
      problemBoundingBox: { x: 0.2, y: 0.1, width: 0.12, height: 0.15 },
      answerBoundingBox: { x: 0.2, y: 0.22, width: 0.12, height: 0.05 },
    },
    {
      problemNumber: 3,
      row: 1,
      column: 3,
      format: "vertical",
      terms: [63, -18],
      correctAnswer: 45,
      studentAnswer: 45,
      studentAnswerConfidence: 0.91,
      termsConfidence: 0.88,
      problemBoundingBox: { x: 0.35, y: 0.1, width: 0.12, height: 0.15 },
      answerBoundingBox: { x: 0.35, y: 0.22, width: 0.12, height: 0.05 },
    },
    {
      problemNumber: 4,
      row: 1,
      column: 4,
      format: "vertical",
      terms: [81, 19],
      correctAnswer: 100,
      studentAnswer: 100,
      studentAnswerConfidence: 0.94,
      termsConfidence: 0.91,
      problemBoundingBox: { x: 0.5, y: 0.1, width: 0.12, height: 0.15 },
      answerBoundingBox: { x: 0.5, y: 0.22, width: 0.12, height: 0.05 },
    },
    {
      problemNumber: 5,
      row: 1,
      column: 5,
      format: "vertical",
      terms: [56, -23],
      correctAnswer: 33,
      studentAnswer: 33,
      studentAnswerConfidence: 0.89,
      termsConfidence: 0.87,
      problemBoundingBox: { x: 0.65, y: 0.1, width: 0.12, height: 0.15 },
      answerBoundingBox: { x: 0.65, y: 0.22, width: 0.12, height: 0.05 },
    },
    {
      problemNumber: 6,
      row: 1,
      column: 6,
      format: "vertical",
      terms: [42, 37],
      correctAnswer: 79,
      studentAnswer: 79,
      studentAnswerConfidence: 0.92,
      termsConfidence: 0.9,
      problemBoundingBox: { x: 0.8, y: 0.1, width: 0.12, height: 0.15 },
      answerBoundingBox: { x: 0.8, y: 0.22, width: 0.12, height: 0.05 },
    },
  ]),
  pageMetadata: {
    lessonId: "Lesson 3",
    weekId: "Week 2",
    pageNumber: 12,
    detectedFormat: "vertical",
    totalRows: 1,
    problemsPerRow: 6,
  },
  overallConfidence: 0.91,
  warnings: [],
  needsReview: false,
};

// =============================================================================
// ACTUAL WORKSHEET IMAGES
// These are real scanned worksheets copied to public/storybook-assets/worksheets/
// =============================================================================

/** 20-problem worksheet image (medium confidence scan) */
const WORKSHEET_20_PROBLEMS_URL =
  "/storybook-assets/worksheets/worksheet-20-problems.jpg";

/** 10-problem worksheet image (low confidence scan) */
const WORKSHEET_10_PROBLEMS_URL =
  "/storybook-assets/worksheets/worksheet-10-problems.jpg";

/** Placeholder for high-confidence synthetic data (no real image available) */
const PLACEHOLDER_WORKSHEET_URL =
  "data:image/svg+xml," +
  encodeURIComponent(`
  <svg width="400" height="520" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f5f5f5"/>
    <text x="200" y="30" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">High Confidence (Synthetic)</text>
    <text x="200" y="260" text-anchor="middle" font-family="Arial" font-size="12" fill="#999">6 problems - all correct</text>
  </svg>
`);

// =============================================================================
// WorksheetReviewSummary Stories
// =============================================================================

const summaryMeta: Meta<typeof WorksheetReviewSummary> = {
  title: "WorksheetParsing/WorksheetReviewSummary",
  component: WorksheetReviewSummary,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div
        style={{ width: "360px", height: "600px", backgroundColor: "#1a1a2e" }}
      >
        <Story />
      </div>
    ),
  ],
};

export default summaryMeta;
type SummaryStory = StoryObj<typeof WorksheetReviewSummary>;

/**
 * Default state with 20 problems needing review
 */
export const Default: SummaryStory = {
  args: {
    thumbnailUrl: WORKSHEET_20_PROBLEMS_URL,
    reviewProgress: null,
    problems: PARSING_RESULT_20_PROBLEMS.problems as ParsedProblem[],
    parsingResult: PARSING_RESULT_20_PROBLEMS,
    onStartReview: () => console.log("Start review clicked"),
    onApproveAll: () => console.log("Approve all clicked"),
  },
};

/**
 * Low confidence scan with poor quality warning
 */
export const PoorScanQuality: SummaryStory = {
  args: {
    thumbnailUrl: WORKSHEET_10_PROBLEMS_URL,
    reviewProgress: null,
    problems: PARSING_RESULT_10_PROBLEMS_LOW_CONF.problems as ParsedProblem[],
    parsingResult: PARSING_RESULT_10_PROBLEMS_LOW_CONF,
    onStartReview: () => console.log("Start review clicked"),
    onApproveAll: () => console.log("Approve all clicked"),
    onRetakePhoto: () => console.log("Retake photo clicked"),
  },
};

/**
 * High confidence scan - all problems auto-approved
 */
export const HighConfidence: SummaryStory = {
  args: {
    thumbnailUrl: PLACEHOLDER_WORKSHEET_URL,
    reviewProgress: null,
    problems: PARSING_RESULT_HIGH_CONF.problems as ParsedProblem[],
    parsingResult: PARSING_RESULT_HIGH_CONF,
    onStartReview: () => console.log("Start review clicked"),
    onApproveAll: () => console.log("Approve all clicked"),
  },
};

/**
 * Review in progress - some problems already reviewed
 */
export const ReviewInProgress: SummaryStory = {
  args: {
    thumbnailUrl: WORKSHEET_20_PROBLEMS_URL,
    reviewProgress: {
      status: "in_progress",
      currentIndex: 8,
      lastReviewedAt: new Date().toISOString(),
      flaggedCount: 7, // 12 originally flagged, 5 now reviewed
      autoApprovedCount: 8,
      manuallyReviewedCount: 5,
      correctedCount: 2,
    },
    problems: PARSING_RESULT_20_PROBLEMS.problems as ParsedProblem[],
    parsingResult: PARSING_RESULT_20_PROBLEMS,
    onStartReview: () => console.log("Continue review clicked"),
    onApproveAll: () => console.log("Approve all clicked"),
  },
};

/**
 * Review completed - ready to create session
 */
export const ReviewCompleted: SummaryStory = {
  args: {
    thumbnailUrl: WORKSHEET_20_PROBLEMS_URL,
    reviewProgress: {
      status: "completed",
      currentIndex: 20,
      lastReviewedAt: new Date().toISOString(),
      flaggedCount: 0, // All flagged problems now reviewed
      autoApprovedCount: 8,
      manuallyReviewedCount: 12,
      correctedCount: 4,
    },
    problems: PARSING_RESULT_20_PROBLEMS.problems as ParsedProblem[],
    parsingResult: PARSING_RESULT_20_PROBLEMS,
    onStartReview: () => console.log("Start review clicked"),
    onApproveAll: () => console.log("Create session clicked"),
  },
};

/**
 * Multi-worksheet session - first of 3
 */
export const MultiWorksheet: SummaryStory = {
  args: {
    thumbnailUrl: WORKSHEET_20_PROBLEMS_URL,
    reviewProgress: null,
    problems: PARSING_RESULT_20_PROBLEMS.problems as ParsedProblem[],
    parsingResult: PARSING_RESULT_20_PROBLEMS,
    worksheetIndex: 1,
    totalWorksheets: 3,
    onStartReview: () => console.log("Start review clicked"),
    onApproveAll: () => console.log("Approve all clicked"),
    onNextWorksheet: () => console.log("Next worksheet clicked"),
  },
};

/**
 * Loading state - approving in progress
 */
export const ApprovingState: SummaryStory = {
  args: {
    thumbnailUrl: PLACEHOLDER_WORKSHEET_URL,
    reviewProgress: null,
    problems: PARSING_RESULT_HIGH_CONF.problems as ParsedProblem[],
    parsingResult: PARSING_RESULT_HIGH_CONF,
    onStartReview: () => console.log("Start review clicked"),
    onApproveAll: () => console.log("Approve all clicked"),
    isApproving: true,
  },
};

// =============================================================================
// Full Flow Interactive Story
// =============================================================================

/**
 * Interactive story wrapper for testing the complete flow
 */
function FullFlowDemo() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<OfflineAttachment[]>([
    {
      id: "att-1",
      url: WORKSHEET_20_PROBLEMS_URL,
      filename: "worksheet-20-problems.jpg",
      parsingStatus: "needs_review",
      rawParsingResult: PARSING_RESULT_20_PROBLEMS,
      needsReview: true,
      sessionCreated: false,
    },
    {
      id: "att-2",
      url: WORKSHEET_10_PROBLEMS_URL,
      filename: "worksheet-10-problems.jpg",
      parsingStatus: "needs_review",
      rawParsingResult: PARSING_RESULT_10_PROBLEMS_LOW_CONF,
      needsReview: true,
      sessionCreated: false,
    },
    {
      id: "att-3",
      url: WORKSHEET_20_PROBLEMS_URL,
      filename: "worksheet-unparsed.jpg",
      parsingStatus: null,
      rawParsingResult: null,
      needsReview: false,
      sessionCreated: false,
    },
    {
      id: "att-4",
      url: WORKSHEET_10_PROBLEMS_URL,
      filename: "worksheet-done.jpg",
      parsingStatus: "approved",
      rawParsingResult: PARSING_RESULT_10_PROBLEMS_LOW_CONF,
      needsReview: false,
      sessionCreated: true,
    },
  ]);

  const [parsingId, setParsingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [initializingReviewId, setInitializingReviewId] = useState<
    string | null
  >(null);
  const [actionLog, setActionLog] = useState<string[]>([]);

  // Viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerMode, setViewerMode] = useState<"view" | "edit" | "review">(
    "view",
  );

  const log = useCallback((msg: string) => {
    setActionLog((prev) => [
      ...prev.slice(-9),
      `${new Date().toLocaleTimeString()}: ${msg}`,
    ]);
  }, []);

  const handleParse = useCallback(
    async (id: string) => {
      log(`Starting parse for ${id}`);
      setParsingId(id);
      // Simulate parsing delay
      await new Promise((r) => setTimeout(r, 2000));
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                parsingStatus: "needs_review" as const,
                rawParsingResult: PARSING_RESULT_20_PROBLEMS,
                needsReview: true,
              }
            : a,
        ),
      );
      setParsingId(null);
      log(`Parse complete for ${id}`);
    },
    [log],
  );

  const handleApproveAll = useCallback(
    async (id: string) => {
      log(`Approving worksheet ${id}`);
      setApprovingId(id);
      await new Promise((r) => setTimeout(r, 1500));
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                parsingStatus: "approved" as const,
                sessionCreated: true,
              }
            : a,
        ),
      );
      setApprovingId(null);
      log(`Approved ${id} - session created!`);
    },
    [log],
  );

  const handleInitializeReview = useCallback(
    async (id: string) => {
      log(`Initializing review for ${id}`);
      setInitializingReviewId(id);
      await new Promise((r) => setTimeout(r, 500));
      setInitializingReviewId(null);
      // Open viewer in review mode
      const index = attachments.findIndex((a) => a.id === id);
      if (index >= 0) {
        setViewerIndex(index);
        setViewerMode("review");
        setViewerOpen(true);
        log(`Review initialized - opening viewer in review mode`);
      }
    },
    [log, attachments],
  );

  const handleOpenViewer = useCallback(
    (index: number, mode: "view" | "edit" | "review") => {
      log(`Open viewer: index=${index}, mode=${mode}`);
      setViewerIndex(index);
      setViewerMode(mode);
      setViewerOpen(true);
    },
    [log],
  );

  const handleCloseViewer = useCallback(() => {
    log("Close viewer");
    setViewerOpen(false);
  }, [log]);

  // Convert attachments to PhotoViewerEditorPhoto format
  const viewerPhotos: PhotoViewerEditorPhoto[] = attachments.map((a) => ({
    id: a.id,
    url: a.url,
    originalUrl: null,
    corners: null,
    rotation: 0 as const,
    parsingStatus: a.parsingStatus ?? undefined,
    rawParsingResult: a.rawParsingResult ?? undefined,
    sessionCreated: a.sessionCreated,
  }));

  // Focus review handlers
  const handleApproveProblem = useCallback(
    async (photoId: string, problemIndex: number) => {
      log(`Focus approve: photo=${photoId}, problem=${problemIndex + 1}`);
      await new Promise((r) => setTimeout(r, 300));
      // Update the problem's review status
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === photoId && a.rawParsingResult
            ? {
                ...a,
                rawParsingResult: {
                  ...a.rawParsingResult,
                  problems: a.rawParsingResult.problems.map((p, i) =>
                    i === problemIndex
                      ? { ...p, reviewStatus: "approved" as const }
                      : p,
                  ),
                },
              }
            : a,
        ),
      );
    },
    [log],
  );

  const handleFlagProblem = useCallback(
    async (photoId: string, problemIndex: number) => {
      log(`Focus flag: photo=${photoId}, problem=${problemIndex + 1}`);
      await new Promise((r) => setTimeout(r, 300));
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === photoId && a.rawParsingResult
            ? {
                ...a,
                rawParsingResult: {
                  ...a.rawParsingResult,
                  problems: a.rawParsingResult.problems.map((p, i) =>
                    i === problemIndex
                      ? { ...p, reviewStatus: "flagged" as const }
                      : p,
                  ),
                },
              }
            : a,
        ),
      );
    },
    [log],
  );

  const handleFocusReviewComplete = useCallback(
    (photoId: string) => {
      log(`Focus review complete: photo=${photoId}`);
      // Mark the attachment as approved
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === photoId
            ? {
                ...a,
                parsingStatus: "approved" as const,
                sessionCreated: true,
              }
            : a,
        ),
      );
      setViewerOpen(false);
    },
    [log],
  );

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 4,
        p: 4,
      })}
    >
      <h2 className={css({ fontSize: "xl", fontWeight: "bold", mb: 2 })}>
        Worksheet Parsing Flow Test
      </h2>

      <div className={css({ display: "flex", gap: 4 })}>
        {/* Main component */}
        <div className={css({ flex: 1, minWidth: "400px" })}>
          <OfflineWorkSection
            attachments={attachments}
            fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
            isUploading={false}
            uploadError={null}
            deletingId={null}
            parsingId={parsingId}
            dragOver={false}
            isDark={false}
            canUpload={true}
            onFileSelect={() => log("File select")}
            onDrop={() => log("Drop")}
            onDragOver={() => {}}
            onDragLeave={() => {}}
            onOpenCamera={() => log("Open camera")}
            onOpenViewer={handleOpenViewer}
            onDeletePhoto={(id) => log(`Delete photo: ${id}`)}
            onParse={handleParse}
            onInitializeReview={handleInitializeReview}
            initializingReviewId={initializingReviewId}
            onApproveAll={handleApproveAll}
            approvingId={approvingId}
          />
        </div>

        {/* Action log */}
        <div
          className={css({
            width: "300px",
            backgroundColor: "gray.100",
            borderRadius: "lg",
            p: 3,
          })}
        >
          <h3 className={css({ fontSize: "sm", fontWeight: "bold", mb: 2 })}>
            Action Log
          </h3>
          <div className={css({ fontSize: "xs", fontFamily: "mono" })}>
            {actionLog.length === 0 ? (
              <span className={css({ color: "gray.500" })}>
                Actions will appear here...
              </span>
            ) : (
              actionLog.map((msg, i) => (
                <div
                  key={i}
                  className={css({
                    py: 1,
                    borderBottom: "1px solid",
                    borderColor: "gray.200",
                  })}
                >
                  {msg}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div
        className={css({
          backgroundColor: "blue.50",
          borderRadius: "lg",
          p: 4,
          mt: 4,
        })}
      >
        <h3 className={css({ fontSize: "sm", fontWeight: "bold", mb: 2 })}>
          Test Instructions
        </h3>
        <ul className={css({ fontSize: "sm", listStyleType: "disc", pl: 4 })}>
          <li>
            <strong>Unparsed photo (att-3):</strong> Click the scan icon to
            parse
          </li>
          <li>
            <strong>Parsed worksheets (att-1, att-2):</strong> Click &quot;Check
            N problems&quot; to open review mode
          </li>
          <li>
            <strong>In review mode:</strong> Use the{" "}
            <strong>List/Focus toggle</strong> to switch between split-view
            (List) and one-at-a-time review (Focus)
          </li>
          <li>
            <strong>Approved worksheet (att-4):</strong> Has &quot;✓ Done&quot;
            badge
          </li>
        </ul>
      </div>

      {/* PhotoViewerEditor modal */}
      {viewerOpen && (
        <div
          className={css({
            position: "fixed",
            inset: 0,
            zIndex: 1000,
          })}
        >
          <VisualDebugProvider>
            <PhotoViewerEditor
              photos={viewerPhotos}
              initialIndex={viewerIndex}
              initialMode={viewerMode}
              isOpen={true}
              onClose={handleCloseViewer}
              onEditConfirm={async () => {}}
              onApprove={handleApproveAll}
              approvingPhotoId={approvingId}
              onApproveProblem={handleApproveProblem}
              onFlagProblem={handleFlagProblem}
              onFocusReviewComplete={handleFocusReviewComplete}
            />
          </VisualDebugProvider>
        </div>
      )}
    </div>
  );
}

/**
 * Full interactive flow for testing the complete worksheet parsing feature.
 * Includes: upload, parse, review summary, and approve functionality.
 */
export const FullFlow: SummaryStory = {
  render: () => (
    <QueryClientProvider client={createQueryClient()}>
      <MockWorksheetParsingProvider>
        <FullFlowDemo />
      </MockWorksheetParsingProvider>
    </QueryClientProvider>
  ),
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "light" },
  },
};
