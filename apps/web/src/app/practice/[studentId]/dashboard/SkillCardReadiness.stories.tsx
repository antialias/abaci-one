import type { Meta, StoryObj } from '@storybook/react'
import type { SkillReadinessDimensions } from '@/lib/curriculum/skill-readiness'
import { css } from '../../../../../styled-system/css'
import {
  SkillCard,
  ReadinessDot,
  type ProcessedSkill,
  type AttentionBadge,
} from './DashboardClient'

// ============================================================================
// Mock Data Helpers
// ============================================================================

function makeSkill(overrides: Partial<ProcessedSkill> & { displayName: string }): ProcessedSkill {
  return {
    id: overrides.id ?? `skill-${overrides.displayName}`,
    skillId: overrides.skillId ?? `skill-${overrides.displayName}`,
    displayName: overrides.displayName,
    category: overrides.category ?? 'Addition',
    categoryOrder: overrides.categoryOrder ?? 1,
    attempts: overrides.attempts ?? 50,
    correct: overrides.correct ?? 45,
    isPracticing: overrides.isPracticing ?? true,
    lastPracticedAt: overrides.lastPracticedAt ?? new Date(),
    daysSinceLastPractice: overrides.daysSinceLastPractice ?? 0,
    avgResponseTimeMs: overrides.avgResponseTimeMs ?? 2500,
    problems: overrides.problems ?? [],
    pKnown: overrides.pKnown ?? 0.9,
    confidence: overrides.confidence ?? 0.7,
    uncertaintyRange: overrides.uncertaintyRange ?? { low: 0.8, high: 0.95 },
    bktClassification: overrides.bktClassification ?? 'strong',
    insufficientDataReason: overrides.insufficientDataReason ?? null,
    stalenessWarning: overrides.stalenessWarning ?? null,
    complexityMultiplier: overrides.complexityMultiplier ?? 1,
    usingBktMultiplier: overrides.usingBktMultiplier ?? false,
    readiness: overrides.readiness ?? null,
    isSolid: overrides.isSolid ?? false,
  }
}

const solidReadiness: SkillReadinessDimensions = {
  mastery: { met: true, pKnown: 0.92, confidence: 0.75 },
  volume: { met: true, opportunities: 35, sessionCount: 5 },
  speed: { met: true, medianSecondsPerTerm: 2.1 },
  consistency: { met: true, recentAccuracy: 0.93, lastFiveAllCorrect: true, recentHelpCount: 0 },
}

const partialReadiness: SkillReadinessDimensions = {
  mastery: { met: true, pKnown: 0.88, confidence: 0.65 },
  volume: { met: true, opportunities: 28, sessionCount: 4 },
  speed: { met: false, medianSecondsPerTerm: 5.3 },
  consistency: { met: false, recentAccuracy: 0.73, lastFiveAllCorrect: false, recentHelpCount: 2 },
}

const solidSkill = makeSkill({
  displayName: '+3',
  skillId: 'add-3',
  pKnown: 0.92,
  bktClassification: 'strong',
  readiness: solidReadiness,
  isSolid: true,
})

const partialSkill = makeSkill({
  displayName: '+4',
  skillId: 'add-4',
  pKnown: 0.85,
  bktClassification: 'developing',
  readiness: partialReadiness,
  isSolid: false,
})

const noReadinessSkill = makeSkill({
  displayName: '+5 - 1',
  skillId: 'sub-5-complement-1',
  pKnown: 0.78,
  bktClassification: 'developing',
  readiness: null,
  isSolid: false,
})

const notPracticingSkill = makeSkill({
  displayName: '+2',
  skillId: 'add-2',
  pKnown: 0.91,
  bktClassification: 'strong',
  isPracticing: false,
  readiness: solidReadiness,
  isSolid: true,
})

const weakSkill = makeSkill({
  displayName: '+5 - 3',
  skillId: 'sub-5-complement-3',
  pKnown: 0.35,
  bktClassification: 'weak',
  attempts: 15,
  correct: 9,
  readiness: {
    mastery: { met: false, pKnown: 0.35, confidence: 0.4 },
    volume: { met: false, opportunities: 15, sessionCount: 2 },
    speed: { met: false, medianSecondsPerTerm: 6.2 },
    consistency: { met: false, recentAccuracy: 0.6, lastFiveAllCorrect: false, recentHelpCount: 4 },
  },
  isSolid: false,
})

// ============================================================================
// Meta
// ============================================================================

/**
 * Stories for the SkillCard component with readiness dimension dots.
 *
 * SkillCard is exported from DashboardClient and shows per-skill readiness
 * via 4 colored dots (mastery, volume, speed, consistency).
 */
const meta: Meta = {
  title: 'Dashboard/SkillCardReadiness',
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
type Story = StoryObj

// ============================================================================
// Individual Stories
// ============================================================================

function CardWrapper({ skill, badges }: { skill: ProcessedSkill; badges?: AttentionBadge[] }) {
  return (
    <div className={css({ width: '160px' })}>
      <SkillCard
        skill={skill}
        isDark={false}
        onClick={() => alert(`Clicked: ${skill.displayName}`)}
        badges={badges}
      />
    </div>
  )
}

export const SolidSkill: Story = {
  render: () => <CardWrapper skill={solidSkill} />,
}

export const PartialReadiness: Story = {
  render: () => <CardWrapper skill={partialSkill} />,
}

export const NoReadinessData: Story = {
  render: () => <CardWrapper skill={noReadinessSkill} />,
}

export const NotPracticing: Story = {
  render: () => <CardWrapper skill={notPracticingSkill} />,
}

export const WeakWithReadiness: Story = {
  render: () => <CardWrapper skill={weakSkill} badges={['weak']} />,
}

// ============================================================================
// Grid Comparison
// ============================================================================

export const GridComparison: Story = {
  render: () => (
    <div
      className={css({
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '1rem',
      })}
    >
      <div>
        <p
          className={css({
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'gray.500',
            marginBottom: '0.375rem',
            textTransform: 'uppercase',
          })}
        >
          Solid (all 4 green)
        </p>
        <SkillCard skill={solidSkill} isDark={false} onClick={() => {}} />
      </div>

      <div>
        <p
          className={css({
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'gray.500',
            marginBottom: '0.375rem',
            textTransform: 'uppercase',
          })}
        >
          Partial (2/4 green)
        </p>
        <SkillCard skill={partialSkill} isDark={false} onClick={() => {}} />
      </div>

      <div>
        <p
          className={css({
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'gray.500',
            marginBottom: '0.375rem',
            textTransform: 'uppercase',
          })}
        >
          No Readiness Data
        </p>
        <SkillCard skill={noReadinessSkill} isDark={false} onClick={() => {}} />
      </div>

      <div>
        <p
          className={css({
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'gray.500',
            marginBottom: '0.375rem',
            textTransform: 'uppercase',
          })}
        >
          Not Practicing
        </p>
        <SkillCard skill={notPracticingSkill} isDark={false} onClick={() => {}} />
      </div>

      <div>
        <p
          className={css({
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'gray.500',
            marginBottom: '0.375rem',
            textTransform: 'uppercase',
          })}
        >
          Weak + Readiness
        </p>
        <SkillCard skill={weakSkill} isDark={false} onClick={() => {}} badges={['weak']} />
      </div>
    </div>
  ),
}

// ============================================================================
// Dark Mode
// ============================================================================

export const DarkModeGrid: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          maxWidth: '600px',
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
  render: () => (
    <div
      className={css({
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '1rem',
      })}
    >
      <SkillCard skill={solidSkill} isDark={true} onClick={() => {}} />
      <SkillCard skill={partialSkill} isDark={true} onClick={() => {}} />
      <SkillCard skill={noReadinessSkill} isDark={true} onClick={() => {}} />
      <SkillCard skill={weakSkill} isDark={true} onClick={() => {}} badges={['weak']} />
    </div>
  ),
}

// ============================================================================
// ReadinessDot Isolated
// ============================================================================

export const ReadinessDotIsolated: Story = {
  render: () => (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' })}>
      <p className={css({ fontSize: '0.875rem', fontWeight: '600', color: 'gray.500' })}>
        Individual ReadinessDot variants
      </p>
      <div className={css({ display: 'flex', gap: '1rem', flexWrap: 'wrap' })}>
        <ReadinessDot label="Mastery" met={true} detail="92%" isDark={false} />
        <ReadinessDot label="Volume" met={true} detail="35 probs" isDark={false} />
        <ReadinessDot label="Speed" met={false} detail="5.3s" isDark={false} />
        <ReadinessDot label="Consistency" met={false} detail="73%" isDark={false} />
      </div>
      <div className={css({ display: 'flex', gap: '1rem', flexWrap: 'wrap' })}>
        <ReadinessDot label="Mastery" met={true} detail="92%" isDark={true} />
        <ReadinessDot label="Volume" met={true} detail="35 probs" isDark={true} />
        <ReadinessDot label="Speed" met={false} detail="5.3s" isDark={true} />
        <ReadinessDot label="Consistency" met={false} detail="73%" isDark={true} />
      </div>
    </div>
  ),
}
