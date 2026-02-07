import type { Meta, StoryObj } from '@storybook/react'
import type { SkillReadinessResult } from '@/lib/curriculum/skill-readiness'
import { css } from '../../../styled-system/css'
import { ReadinessReport } from './ReadinessReport'

// ============================================================================
// Mock Data
// ============================================================================

function makeReadiness(overrides: {
  skillId?: string
  isSolid?: boolean
  mastery?: { met: boolean; pKnown: number; confidence: number }
  volume?: { met: boolean; opportunities: number; sessionCount: number }
  speed?: { met: boolean; medianSecondsPerTerm: number | null }
  consistency?: {
    met: boolean
    recentAccuracy: number
    lastFiveAllCorrect: boolean
    recentHelpCount: number
  }
}): SkillReadinessResult {
  return {
    skillId: overrides.skillId ?? 'add-3',
    isSolid: overrides.isSolid ?? false,
    dimensions: {
      mastery: overrides.mastery ?? { met: true, pKnown: 0.92, confidence: 0.75 },
      volume: overrides.volume ?? { met: true, opportunities: 35, sessionCount: 5 },
      speed: overrides.speed ?? { met: true, medianSecondsPerTerm: 2.1 },
      consistency: overrides.consistency ?? {
        met: true,
        recentAccuracy: 0.93,
        lastFiveAllCorrect: true,
        recentHelpCount: 0,
      },
    },
  }
}

const allMetReadiness: Record<string, SkillReadinessResult> = {
  'add-3': makeReadiness({ skillId: 'add-3', isSolid: true }),
}

const someDimensionsUnmet: Record<string, SkillReadinessResult> = {
  'add-3': makeReadiness({
    skillId: 'add-3',
    isSolid: false,
    mastery: { met: true, pKnown: 0.88, confidence: 0.65 },
    volume: { met: true, opportunities: 28, sessionCount: 4 },
    speed: { met: false, medianSecondsPerTerm: 5.3 },
    consistency: {
      met: false,
      recentAccuracy: 0.73,
      lastFiveAllCorrect: false,
      recentHelpCount: 2,
    },
  }),
}

const noDimensionsMet: Record<string, SkillReadinessResult> = {
  'add-3': makeReadiness({
    skillId: 'add-3',
    isSolid: false,
    mastery: { met: false, pKnown: 0.45, confidence: 0.3 },
    volume: { met: false, opportunities: 8, sessionCount: 1 },
    speed: { met: false, medianSecondsPerTerm: null },
    consistency: { met: false, recentAccuracy: 0.6, lastFiveAllCorrect: false, recentHelpCount: 3 },
  }),
}

const multipleSkills: Record<string, SkillReadinessResult> = {
  'add-3': makeReadiness({
    skillId: 'add-3',
    isSolid: true,
  }),
  'add-4': makeReadiness({
    skillId: 'add-4',
    isSolid: false,
    mastery: { met: true, pKnown: 0.87, confidence: 0.6 },
    volume: { met: false, opportunities: 12, sessionCount: 2 },
    speed: { met: false, medianSecondsPerTerm: 4.8 },
    consistency: { met: true, recentAccuracy: 0.9, lastFiveAllCorrect: true, recentHelpCount: 0 },
  }),
}

const threeOfFourMet: Record<string, SkillReadinessResult> = {
  'add-3': makeReadiness({
    skillId: 'add-3',
    isSolid: false,
    mastery: { met: true, pKnown: 0.9, confidence: 0.7 },
    volume: { met: true, opportunities: 25, sessionCount: 4 },
    speed: { met: true, medianSecondsPerTerm: 2.5 },
    consistency: { met: false, recentAccuracy: 0.8, lastFiveAllCorrect: false, recentHelpCount: 1 },
  }),
}

// ============================================================================
// Meta
// ============================================================================

const meta: Meta<typeof ReadinessReport> = {
  title: 'Practice/ReadinessReport',
  component: ReadinessReport,
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          maxWidth: '500px',
          margin: '0 auto',
        })}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof ReadinessReport>

// ============================================================================
// Full Variant Stories
// ============================================================================

export const AllDimensionsMet: Story = {
  args: {
    readiness: allMetReadiness,
    variant: 'full',
  },
}

export const SomeDimensionsUnmet: Story = {
  args: {
    readiness: someDimensionsUnmet,
    variant: 'full',
  },
}

export const NoDimensionsMet: Story = {
  args: {
    readiness: noDimensionsMet,
    variant: 'full',
  },
}

export const MultipleSkills: Story = {
  args: {
    readiness: multipleSkills,
    variant: 'full',
  },
}

// ============================================================================
// Compact Variant Stories
// ============================================================================

export const CompactSolid: Story = {
  args: {
    readiness: allMetReadiness,
    variant: 'compact',
  },
}

export const CompactPartial: Story = {
  args: {
    readiness: threeOfFourMet,
    variant: 'compact',
  },
}

// ============================================================================
// Comparison Story
// ============================================================================

export const AllVariantsComparison: Story = {
  render: () => (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '2rem' })}>
      <div>
        <h3
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'gray.500',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          })}
        >
          Full — All Met
        </h3>
        <ReadinessReport readiness={allMetReadiness} variant="full" />
      </div>

      <div>
        <h3
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'gray.500',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          })}
        >
          Full — 2/4 Unmet (Speed + Consistency)
        </h3>
        <ReadinessReport readiness={someDimensionsUnmet} variant="full" />
      </div>

      <div>
        <h3
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'gray.500',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          })}
        >
          Full — None Met (Early Learner)
        </h3>
        <ReadinessReport readiness={noDimensionsMet} variant="full" />
      </div>

      <div>
        <h3
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'gray.500',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          })}
        >
          Full — Multiple Skills (worst shown)
        </h3>
        <ReadinessReport readiness={multipleSkills} variant="full" />
      </div>

      <div>
        <h3
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'gray.500',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          })}
        >
          Compact — Solid (all met)
        </h3>
        <ReadinessReport readiness={allMetReadiness} variant="compact" />
      </div>

      <div>
        <h3
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'gray.500',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          })}
        >
          Compact — 3/4 Solid
        </h3>
        <ReadinessReport readiness={threeOfFourMet} variant="compact" />
      </div>
    </div>
  ),
}

// ============================================================================
// Dark Mode
// ============================================================================

export const DarkModeAllMet: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          maxWidth: '500px',
          margin: '0 auto',
          backgroundColor: 'gray.900',
          borderRadius: '12px',
        })}
        data-theme="dark"
      >
        <Story />
      </div>
    ),
  ],
  args: {
    readiness: allMetReadiness,
    variant: 'full',
  },
}

export const DarkModeSomeUnmet: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          maxWidth: '500px',
          margin: '0 auto',
          backgroundColor: 'gray.900',
          borderRadius: '12px',
        })}
        data-theme="dark"
      >
        <Story />
      </div>
    ),
  ],
  args: {
    readiness: someDimensionsUnmet,
    variant: 'full',
  },
}

export const DarkModeCompact: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          maxWidth: '500px',
          margin: '0 auto',
          backgroundColor: 'gray.900',
          borderRadius: '12px',
        })}
        data-theme="dark"
      >
        <Story />
      </div>
    ),
  ],
  args: {
    readiness: threeOfFourMet,
    variant: 'compact',
  },
}
