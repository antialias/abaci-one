import type { Meta, StoryObj } from '@storybook/react'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import { SessionProgressIndicator } from './SessionProgressIndicator'

const meta: Meta<typeof SessionProgressIndicator> = {
  title: 'Practice/SessionProgressIndicator',
  component: SessionProgressIndicator,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    isDark: { control: 'boolean' },
    isBrowseMode: { control: 'boolean' },
    compact: { control: 'boolean' },
  },
  decorators: [
    (Story, context) => (
      <div
        style={{
          backgroundColor: context.args.isDark ? '#1a1a2e' : '#f5f5f5',
          padding: '1rem',
          borderRadius: '8px',
          maxWidth: '600px',
        }}
      >
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionProgressIndicator>

// Helper to create slots
function createSlots(count: number): SessionPart['slots'] {
  return Array.from({ length: count }, (_, i) => ({
    skillId: `skill-${i}`,
    problem: { operands: [1, 2], operator: '+' as const, answer: 3 },
  }))
}

// Helper to create a single part
function createPart(partNumber: number, type: SessionPart['type'], slotCount: number): SessionPart {
  return {
    partNumber,
    type,
    slots: createSlots(slotCount),
  }
}

// Helper to create results
function createResults(
  partNumber: number,
  count: number,
  pattern: 'all-correct' | 'all-incorrect' | 'mixed' | 'none' = 'none'
): SlotResult[] {
  if (pattern === 'none') return []

  return Array.from({ length: count }, (_, i) => ({
    partNumber,
    slotIndex: i,
    isCorrect: pattern === 'all-correct' ? true : pattern === 'all-incorrect' ? false : i % 3 !== 2, // Mixed: 2/3 correct
    responseTimeMs: 1500 + Math.random() * 2000,
    timestamp: Date.now() - (count - i) * 5000,
  }))
}

// ============================================
// PROBLEM COUNT VARIATIONS (Practice Mode)
// ============================================

export const Small5Problems: Story = {
  args: {
    parts: [createPart(1, 'abacus', 5)],
    results: createResults(1, 2, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 2,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const Small10Problems: Story = {
  args: {
    parts: [createPart(1, 'abacus', 10)],
    results: createResults(1, 5, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 5,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const Medium15Problems: Story = {
  args: {
    parts: [createPart(1, 'abacus', 15)],
    results: createResults(1, 7, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 7,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const Medium20Problems: Story = {
  args: {
    parts: [createPart(1, 'abacus', 20)],
    results: createResults(1, 10, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 10,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const Large30Problems: Story = {
  args: {
    parts: [createPart(1, 'abacus', 30)],
    results: createResults(1, 15, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 15,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const Large35Problems: Story = {
  args: {
    parts: [createPart(1, 'abacus', 35)],
    results: createResults(1, 17, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 17,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const ExtraLarge40Problems: Story = {
  args: {
    parts: [createPart(1, 'abacus', 40)],
    results: createResults(1, 20, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 20,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const ExtraLarge50Problems: Story = {
  args: {
    parts: [createPart(1, 'abacus', 50)],
    results: createResults(1, 25, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 25,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

// ============================================
// DARK MODE VARIATIONS
// ============================================

export const DarkSmall5Problems: Story = {
  args: {
    ...Small5Problems.args,
    isDark: true,
  },
}

export const DarkMedium20Problems: Story = {
  args: {
    ...Medium20Problems.args,
    isDark: true,
  },
}

export const DarkLarge35Problems: Story = {
  args: {
    ...Large35Problems.args,
    isDark: true,
  },
}

export const DarkExtraLarge50Problems: Story = {
  args: {
    ...ExtraLarge50Problems.args,
    isDark: true,
  },
}

// ============================================
// BROWSE MODE VARIATIONS
// ============================================

export const BrowseSmall5Problems: Story = {
  args: {
    ...Small5Problems.args,
    isBrowseMode: true,
  },
}

export const BrowseMedium20Problems: Story = {
  args: {
    ...Medium20Problems.args,
    isBrowseMode: true,
  },
}

export const BrowseLarge35Problems: Story = {
  args: {
    ...Large35Problems.args,
    isBrowseMode: true,
  },
}

export const BrowseDarkMedium20Problems: Story = {
  args: {
    ...Medium20Problems.args,
    isBrowseMode: true,
    isDark: true,
  },
}

// ============================================
// PROGRESS STATE VARIATIONS
// ============================================

export const AtStart: Story = {
  args: {
    parts: [createPart(1, 'abacus', 10)],
    results: [],
    currentPartIndex: 0,
    currentSlotIndex: 0,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const AtMiddle: Story = {
  args: {
    parts: [createPart(1, 'abacus', 10)],
    results: createResults(1, 5, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 5,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const AtEnd: Story = {
  args: {
    parts: [createPart(1, 'abacus', 10)],
    results: createResults(1, 9, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 9,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const AllCorrect: Story = {
  args: {
    parts: [createPart(1, 'abacus', 10)],
    results: createResults(1, 5, 'all-correct'),
    currentPartIndex: 0,
    currentSlotIndex: 5,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const AllIncorrect: Story = {
  args: {
    parts: [createPart(1, 'abacus', 10)],
    results: createResults(1, 5, 'all-incorrect'),
    currentPartIndex: 0,
    currentSlotIndex: 5,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const MixedResults: Story = {
  args: {
    parts: [createPart(1, 'abacus', 10)],
    results: createResults(1, 5, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 5,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

// ============================================
// MULTI-PART SESSION VARIATIONS
// ============================================

export const TwoPartsFirstActive: Story = {
  args: {
    parts: [createPart(1, 'abacus', 8), createPart(2, 'visualization', 8)],
    results: createResults(1, 4, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 4,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const TwoPartsSecondActive: Story = {
  args: {
    parts: [createPart(1, 'abacus', 8), createPart(2, 'visualization', 8)],
    results: [...createResults(1, 8, 'all-correct'), ...createResults(2, 3, 'mixed')],
    currentPartIndex: 1,
    currentSlotIndex: 3,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const ThreePartsMiddleActive: Story = {
  args: {
    parts: [
      createPart(1, 'abacus', 6),
      createPart(2, 'visualization', 6),
      createPart(3, 'linear', 6),
    ],
    results: [...createResults(1, 6, 'all-correct'), ...createResults(2, 3, 'mixed')],
    currentPartIndex: 1,
    currentSlotIndex: 3,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const ThreePartsLastActive: Story = {
  args: {
    parts: [
      createPart(1, 'abacus', 6),
      createPart(2, 'visualization', 6),
      createPart(3, 'linear', 6),
    ],
    results: [
      ...createResults(1, 6, 'all-correct'),
      ...createResults(2, 6, 'mixed'),
      ...createResults(3, 2, 'all-correct'),
    ],
    currentPartIndex: 2,
    currentSlotIndex: 2,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const ThreePartsBrowseMode: Story = {
  args: {
    parts: [
      createPart(1, 'abacus', 6),
      createPart(2, 'visualization', 6),
      createPart(3, 'linear', 6),
    ],
    results: [
      ...createResults(1, 6, 'all-correct'),
      ...createResults(2, 6, 'mixed'),
      ...createResults(3, 2, 'all-correct'),
    ],
    currentPartIndex: 2,
    currentSlotIndex: 2,
    isBrowseMode: true,
    isDark: false,
    compact: false,
  },
}

// ============================================
// COMPACT MODE VARIATIONS
// ============================================

export const CompactSmall: Story = {
  args: {
    ...Small10Problems.args,
    compact: true,
  },
}

export const CompactMedium: Story = {
  args: {
    ...Medium20Problems.args,
    compact: true,
  },
}

export const CompactLarge: Story = {
  args: {
    ...Large35Problems.args,
    compact: true,
  },
}

export const CompactDark: Story = {
  args: {
    ...Medium20Problems.args,
    compact: true,
    isDark: true,
  },
}

// ============================================
// MULTI-PART WITH VARYING SIZES
// ============================================

export const MixedSizeParts: Story = {
  args: {
    parts: [
      createPart(1, 'abacus', 5),
      createPart(2, 'visualization', 15),
      createPart(3, 'linear', 10),
    ],
    results: [...createResults(1, 5, 'all-correct'), ...createResults(2, 7, 'mixed')],
    currentPartIndex: 1,
    currentSlotIndex: 7,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const LargeMultiPart: Story = {
  args: {
    parts: [
      createPart(1, 'abacus', 15),
      createPart(2, 'visualization', 15),
      createPart(3, 'linear', 15),
    ],
    results: [...createResults(1, 15, 'mixed'), ...createResults(2, 7, 'mixed')],
    currentPartIndex: 1,
    currentSlotIndex: 7,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

// ============================================
// EDGE CASES
// ============================================

export const MinimumTwoProblems: Story = {
  args: {
    parts: [createPart(1, 'abacus', 2)],
    results: createResults(1, 1, 'all-correct'),
    currentPartIndex: 0,
    currentSlotIndex: 1,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const SingleProblem: Story = {
  args: {
    parts: [createPart(1, 'abacus', 1)],
    results: [],
    currentPartIndex: 0,
    currentSlotIndex: 0,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

export const MaximumFiftyProblems: Story = {
  args: {
    parts: [createPart(1, 'abacus', 50)],
    results: createResults(1, 49, 'mixed'),
    currentPartIndex: 0,
    currentSlotIndex: 49,
    isBrowseMode: false,
    isDark: false,
    compact: false,
  },
}

// ============================================
// RESPONSIVE PREVIEW (use viewport addon)
// ============================================

export const ResponsiveSmall: Story = {
  args: {
    ...Small10Problems.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

export const ResponsiveMedium: Story = {
  args: {
    ...Medium20Problems.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

export const ResponsiveLarge: Story = {
  args: {
    ...Large35Problems.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

export const ResponsiveExtraLarge: Story = {
  args: {
    ...ExtraLarge50Problems.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}
