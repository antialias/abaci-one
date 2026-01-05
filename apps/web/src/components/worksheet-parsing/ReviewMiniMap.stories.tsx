/**
 * ReviewMiniMap Stories
 *
 * Stories for the spatial context minimap showing worksheet with problem locations.
 */

import type { Meta, StoryObj } from '@storybook/react'
import type { ParsedProblem } from '@/lib/worksheet-parsing'
import { ReviewMiniMap } from './ReviewMiniMap'

/** Worksheet image for testing */
const WORKSHEET_URL = '/storybook-assets/worksheets/worksheet-20-problems.jpg'

/** Helper to create complete problem objects */
function completeProblem(
  raw: Omit<ParsedProblem, 'notes' | 'excluded' | 'reviewStatus' | 'reviewedAt'> & {
    notes?: string | null
    excluded?: boolean
    reviewStatus?: 'pending' | 'approved' | 'corrected' | 'flagged'
    reviewedAt?: string | null
  }
): ParsedProblem {
  return {
    ...raw,
    notes: raw.notes ?? null,
    excluded: raw.excluded ?? false,
    reviewStatus: raw.reviewStatus ?? 'pending',
    reviewedAt: raw.reviewedAt ?? null,
  }
}

/** Sample 20-problem dataset */
const SAMPLE_PROBLEMS: ParsedProblem[] = [
  {
    problemNumber: 1,
    row: 1,
    column: 1,
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
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
    format: 'vertical',
    terms: [189, 11, 56, -44, -51],
    correctAnswer: 161,
    studentAnswer: 49,
    studentAnswerConfidence: 0.7,
    termsConfidence: 0.62,
    problemBoundingBox: { x: 0.887, y: 0.268, width: 0.083, height: 0.186 },
    answerBoundingBox: { x: 0.876, y: 0.45, width: 0.094, height: 0.05 },
  },
].map(completeProblem)

const meta: Meta<typeof ReviewMiniMap> = {
  title: 'WorksheetParsing/ReviewMiniMap',
  component: ReviewMiniMap,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '500px', backgroundColor: '#1a1a2e', padding: '16px' }}>
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ReviewMiniMap>

/** Full size mini-map with all problems pending */
export const Default: Story = {
  args: {
    worksheetImageUrl: WORKSHEET_URL,
    problems: SAMPLE_PROBLEMS,
    currentIndex: 5,
    onSelectProblem: (index) => console.log('Selected problem:', index),
    isDark: true,
    compact: false,
  },
}

/** Compact mini-map (smaller height) */
export const Compact: Story = {
  args: {
    worksheetImageUrl: WORKSHEET_URL,
    problems: SAMPLE_PROBLEMS,
    currentIndex: 3,
    onSelectProblem: (index) => console.log('Selected problem:', index),
    isDark: true,
    compact: true,
  },
}

/** Mini-map with mixed review statuses */
export const MixedStatuses: Story = {
  args: {
    worksheetImageUrl: WORKSHEET_URL,
    problems: SAMPLE_PROBLEMS.map((p, i) => ({
      ...p,
      reviewStatus: i < 5 ? 'approved' : i < 8 ? 'corrected' : i < 10 ? 'flagged' : 'pending',
    })) as ParsedProblem[],
    currentIndex: 10,
    onSelectProblem: (index) => console.log('Selected problem:', index),
    isDark: true,
    compact: false,
  },
}

/** Light mode */
export const LightMode: Story = {
  args: {
    worksheetImageUrl: WORKSHEET_URL,
    problems: SAMPLE_PROBLEMS,
    currentIndex: 5,
    onSelectProblem: (index) => console.log('Selected problem:', index),
    isDark: false,
    compact: false,
  },
  parameters: {
    backgrounds: { default: 'light' },
  },
}
