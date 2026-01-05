/**
 * ProblemReviewCard Stories
 *
 * Stories for the individual problem review card used in focus review mode.
 */

import type { Meta, StoryObj } from "@storybook/react";
import type { ParsedProblem } from "@/lib/worksheet-parsing";
import { ProblemReviewCard } from "./ProblemReviewCard";

/** Worksheet image for testing */
const WORKSHEET_URL = "/storybook-assets/worksheets/worksheet-20-problems.jpg";

/** Helper to create complete problem objects */
function completeProblem(
  raw: Omit<
    ParsedProblem,
    "notes" | "excluded" | "reviewStatus" | "reviewedAt"
  > & {
    notes?: string | null;
    excluded?: boolean;
    reviewStatus?: "pending" | "approved" | "corrected" | "flagged";
    reviewedAt?: string | null;
  },
): ParsedProblem {
  return {
    ...raw,
    notes: raw.notes ?? null,
    excluded: raw.excluded ?? false,
    reviewStatus: raw.reviewStatus ?? "pending",
    reviewedAt: raw.reviewedAt ?? null,
  };
}

/** Sample problem for card stories */
const SAMPLE_PROBLEM: ParsedProblem = completeProblem({
  problemNumber: 5,
  row: 1,
  column: 5,
  format: "vertical",
  terms: [57, 52, 14, 5],
  correctAnswer: 128,
  studentAnswer: 100,
  studentAnswerConfidence: 0.85,
  termsConfidence: 0.75,
  problemBoundingBox: { x: 0.406, y: 0.07, width: 0.088, height: 0.18 },
  answerBoundingBox: { x: 0.406, y: 0.205, width: 0.088, height: 0.045 },
});

const meta: Meta<typeof ProblemReviewCard> = {
  title: "WorksheetParsing/ProblemReviewCard",
  component: ProblemReviewCard,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div
        style={{ width: "400px", backgroundColor: "#1a1a2e", padding: "16px" }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProblemReviewCard>;

/** Pending review - needs user decision */
export const Pending: Story = {
  args: {
    problem: { ...SAMPLE_PROBLEM, reviewStatus: "pending" },
    index: 4,
    totalProblems: 20,
    worksheetImageUrl: WORKSHEET_URL,
    onSubmitCorrection: async (correction) =>
      console.log("Submit correction:", correction),
    onApprove: async () => console.log("Approved"),
    onFlag: async () => console.log("Flagged"),
    onNext: () => console.log("Next"),
    onPrev: () => console.log("Prev"),
    isSaving: false,
    isDark: true,
  },
};

/** Correct answer - student got it right */
export const CorrectAnswer: Story = {
  args: {
    problem: {
      ...SAMPLE_PROBLEM,
      studentAnswer: 128, // Correct!
      reviewStatus: "pending",
    },
    index: 4,
    totalProblems: 20,
    worksheetImageUrl: WORKSHEET_URL,
    onSubmitCorrection: async (correction) =>
      console.log("Submit correction:", correction),
    onApprove: async () => console.log("Approved"),
    onFlag: async () => console.log("Flagged"),
    onNext: () => console.log("Next"),
    onPrev: () => console.log("Prev"),
    isSaving: false,
    isDark: true,
  },
};

/** Low confidence - highlighting uncertainty */
export const LowConfidence: Story = {
  args: {
    problem: {
      ...SAMPLE_PROBLEM,
      termsConfidence: 0.45,
      studentAnswerConfidence: 0.3,
      reviewStatus: "pending",
    },
    index: 4,
    totalProblems: 20,
    worksheetImageUrl: WORKSHEET_URL,
    onSubmitCorrection: async (correction) =>
      console.log("Submit correction:", correction),
    onApprove: async () => console.log("Approved"),
    onFlag: async () => console.log("Flagged"),
    onNext: () => console.log("Next"),
    onPrev: () => console.log("Prev"),
    isSaving: false,
    isDark: true,
  },
};

/** Saving state - during correction submission */
export const Saving: Story = {
  args: {
    problem: SAMPLE_PROBLEM,
    index: 4,
    totalProblems: 20,
    worksheetImageUrl: WORKSHEET_URL,
    onSubmitCorrection: async (correction) =>
      console.log("Submit correction:", correction),
    onApprove: async () => console.log("Approved"),
    onFlag: async () => console.log("Flagged"),
    onNext: () => console.log("Next"),
    onPrev: () => console.log("Prev"),
    isSaving: true,
    isDark: true,
  },
};
