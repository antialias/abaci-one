'use client'

import type { Meta, StoryObj } from '@storybook/react'
import React, { useEffect } from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import {
  SessionModeBannerProvider,
  useSessionModeBanner,
} from '@/contexts/SessionModeBannerContext'
import { ContentBannerSlot, ProjectingBanner } from '@/components/practice/BannerSlots'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { SkillReadinessDimensions, SkillReadinessResult } from '@/lib/curriculum/skill-readiness'
import { css } from '../../../../../styled-system/css'
import { SkillCard, type ProcessedSkill, type AttentionBadge } from './DashboardClient'

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

const weakReadiness: SkillReadinessDimensions = {
  mastery: { met: false, pKnown: 0.35, confidence: 0.4 },
  volume: { met: false, opportunities: 15, sessionCount: 2 },
  speed: { met: false, medianSecondsPerTerm: 6.2 },
  consistency: { met: false, recentAccuracy: 0.6, lastFiveAllCorrect: false, recentHelpCount: 4 },
}

// Mixed readiness skills across 3 categories
const mockSkills: Array<ProcessedSkill & { _badges?: AttentionBadge[] }> = [
  // Addition category
  makeSkill({
    displayName: '+1',
    skillId: 'add.1',
    category: 'Addition',
    categoryOrder: 1,
    pKnown: 0.95,
    bktClassification: 'strong',
    readiness: solidReadiness,
    isSolid: true,
  }),
  makeSkill({
    displayName: '+2',
    skillId: 'add.2',
    category: 'Addition',
    categoryOrder: 1,
    pKnown: 0.91,
    bktClassification: 'strong',
    readiness: solidReadiness,
    isSolid: true,
  }),
  makeSkill({
    displayName: '+3',
    skillId: 'add.3',
    category: 'Addition',
    categoryOrder: 1,
    pKnown: 0.85,
    bktClassification: 'developing',
    readiness: partialReadiness,
    isSolid: false,
  }),
  // Five Complements category
  makeSkill({
    displayName: '+5 - 1',
    skillId: 'fc.1',
    category: 'Five Complements',
    categoryOrder: 2,
    pKnown: 0.88,
    bktClassification: 'strong',
    readiness: solidReadiness,
    isSolid: true,
  }),
  makeSkill({
    displayName: '+5 - 2',
    skillId: 'fc.2',
    category: 'Five Complements',
    categoryOrder: 2,
    pKnown: 0.78,
    bktClassification: 'developing',
    readiness: null,
    isSolid: false,
  }),
  // Ten Complements category
  makeSkill({
    displayName: '+10 - 1',
    skillId: 'tc.1',
    category: 'Ten Complements',
    categoryOrder: 3,
    pKnown: 0.35,
    bktClassification: 'weak',
    attempts: 15,
    correct: 9,
    readiness: weakReadiness,
    isSolid: false,
  }),
  makeSkill({
    displayName: '+10 - 2',
    skillId: 'tc.2',
    category: 'Ten Complements',
    categoryOrder: 3,
    pKnown: 0.82,
    bktClassification: 'developing',
    readiness: partialReadiness,
    isSolid: false,
  }),
  makeSkill({
    displayName: '+10 - 3',
    skillId: 'tc.3',
    category: 'Ten Complements',
    categoryOrder: 3,
    isPracticing: false,
    pKnown: 0.92,
    bktClassification: 'strong',
    readiness: solidReadiness,
    isSolid: true,
  }),
]

const allSolidSkills: ProcessedSkill[] = [
  makeSkill({ displayName: '+1', skillId: 'add.1', category: 'Addition', categoryOrder: 1, readiness: solidReadiness, isSolid: true }),
  makeSkill({ displayName: '+2', skillId: 'add.2', category: 'Addition', categoryOrder: 1, readiness: solidReadiness, isSolid: true }),
  makeSkill({ displayName: '+3', skillId: 'add.3', category: 'Addition', categoryOrder: 1, readiness: solidReadiness, isSolid: true }),
  makeSkill({ displayName: '+5 - 1', skillId: 'fc.1', category: 'Five Complements', categoryOrder: 2, readiness: solidReadiness, isSolid: true }),
  makeSkill({ displayName: '+5 - 2', skillId: 'fc.2', category: 'Five Complements', categoryOrder: 2, readiness: solidReadiness, isSolid: true }),
  makeSkill({ displayName: '+10 - 1', skillId: 'tc.1', category: 'Ten Complements', categoryOrder: 3, readiness: solidReadiness, isSolid: true }),
  makeSkill({ displayName: '+10 - 2', skillId: 'tc.2', category: 'Ten Complements', categoryOrder: 3, readiness: solidReadiness, isSolid: true }),
  makeSkill({ displayName: '+10 - 3', skillId: 'tc.3', category: 'Ten Complements', categoryOrder: 3, readiness: solidReadiness, isSolid: true }),
]

// ============================================================================
// Session Mode Mocks
// ============================================================================

const mockProgressionSoftNudge: SessionMode = {
  type: 'progression',
  nextSkill: { skillId: 'heaven.5', displayName: '+5 (Heaven Bead)', pKnown: 0 },
  phase: {
    id: 'level1-phase2',
    name: 'Heaven Bead',
    primarySkillId: 'heaven.5',
  } as any,
  tutorialRequired: true,
  skipCount: 0,
  focusDescription: 'Ready to learn +5 (Heaven Bead)',
  canSkipTutorial: true,
}

const mockMaintenanceDeferredPartial: SessionMode = {
  type: 'maintenance',
  skillCount: 5,
  focusDescription: 'Mixed practice',
  deferredProgression: {
    nextSkill: { skillId: 'heaven.5', displayName: '+5 (Heaven Bead)', pKnown: 0 },
    readiness: {
      'add.3': {
        skillId: 'add.3',
        isSolid: false,
        dimensions: {
          mastery: { met: true, pKnown: 0.88, confidence: 0.65 },
          volume: { met: true, opportunities: 28, sessionCount: 4 },
          speed: { met: false, medianSecondsPerTerm: 5.3 },
          consistency: { met: false, recentAccuracy: 0.73, lastFiveAllCorrect: false, recentHelpCount: 2 },
        },
      } satisfies SkillReadinessResult,
    },
    phase: { id: 'level1-phase2', name: 'Heaven Bead', primarySkillId: 'heaven.5' } as any,
  },
}

const mockMaintenanceDeferredAllMet: SessionMode = {
  type: 'maintenance',
  skillCount: 5,
  focusDescription: 'Mixed practice',
  deferredProgression: {
    nextSkill: { skillId: 'heaven.5', displayName: '+5 (Heaven Bead)', pKnown: 0 },
    readiness: {
      'add.3': {
        skillId: 'add.3',
        isSolid: true,
        dimensions: solidReadiness,
      } satisfies SkillReadinessResult,
      'add.4': {
        skillId: 'add.4',
        isSolid: true,
        dimensions: solidReadiness,
      } satisfies SkillReadinessResult,
    },
    phase: { id: 'level1-phase2', name: 'Heaven Bead', primarySkillId: 'heaven.5' } as any,
  },
}

const mockPureMaintenance: SessionMode = {
  type: 'maintenance',
  skillCount: 8,
  focusDescription: 'All 8 skills mastered - maintenance practice',
}

const mockRemediationBlocked: SessionMode = {
  type: 'remediation',
  weakSkills: [
    { skillId: 'add.3', displayName: '+3', pKnown: 0.45 },
    { skillId: 'add.4', displayName: '+4', pKnown: 0.52 },
  ],
  focusDescription: 'Strengthen prerequisites to unlock +5',
  blockedPromotion: {
    nextSkill: { skillId: 'heaven.5', displayName: '+5 (Heaven Bead)', pKnown: 0 },
    reason: 'Strengthen +3 and +4 first',
    phase: { id: 'level1-phase2', name: 'Heaven Bead', primarySkillId: 'heaven.5' } as any,
    tutorialReady: false,
  },
}

// ============================================================================
// Helper Components
// ============================================================================

function ActionRegistrar() {
  const { setOnAction, setOnDefer } = useSessionModeBanner()
  useEffect(() => {
    setOnAction(() => alert('Practice action triggered!'))
    setOnDefer(() => alert('Defer triggered! Will ask again later.'))
  }, [setOnAction, setOnDefer])
  return null
}

// ============================================================================
// Page Layout Component
// ============================================================================

interface DashboardReadinessDemoProps {
  sessionMode: SessionMode
  skills: ProcessedSkill[]
  darkMode?: boolean
  badgeMap?: Record<string, AttentionBadge[]>
}

function DashboardReadinessDemo({
  sessionMode,
  skills,
  darkMode = false,
  badgeMap = {},
}: DashboardReadinessDemoProps) {
  // Group skills by category
  const categories = new Map<string, ProcessedSkill[]>()
  for (const skill of skills) {
    const cat = skill.category
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(skill)
  }

  // Sort categories by categoryOrder
  const sortedCategories = [...categories.entries()].sort(
    (a, b) => (a[1][0]?.categoryOrder ?? 0) - (b[1][0]?.categoryOrder ?? 0)
  )

  return (
    <ThemeProvider>
      <SessionModeBannerProvider sessionMode={sessionMode} isLoading={false}>
        <ActionRegistrar />
        <ProjectingBanner />

        <div
          data-component="dashboard-readiness-demo"
          className={css({
            minHeight: '100vh',
            backgroundColor: darkMode ? '#1a1a2e' : 'gray.50',
          })}
        >
          {/* Page header */}
          <div
            className={css({
              padding: '1.5rem 2rem 0',
              maxWidth: '900px',
              margin: '0 auto',
            })}
          >
            <h1
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: darkMode ? 'white' : 'gray.800',
                marginBottom: '1rem',
              })}
            >
              Sonia's Practice Dashboard
            </h1>

            {/* Banner slot */}
            <ContentBannerSlot className={css({ marginBottom: '1.5rem' })} />
          </div>

          {/* Skill grid grouped by category */}
          <div
            className={css({
              padding: '0 2rem 2rem',
              maxWidth: '900px',
              margin: '0 auto',
            })}
          >
            {sortedCategories.map(([categoryName, categorySkills]) => (
              <div key={categoryName} className={css({ marginBottom: '1.5rem' })}>
                <h2
                  className={css({
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: darkMode ? 'gray.300' : 'gray.600',
                    marginBottom: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  })}
                >
                  {categoryName}
                </h2>
                <div
                  className={css({
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '0.75rem',
                  })}
                >
                  {categorySkills.map((skill) => (
                    <SkillCard
                      key={skill.skillId}
                      skill={skill}
                      isDark={darkMode}
                      onClick={() => alert(`Clicked: ${skill.displayName}`)}
                      badges={badgeMap[skill.skillId]}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SessionModeBannerProvider>
    </ThemeProvider>
  )
}

// ============================================================================
// Story Configuration
// ============================================================================

const meta: Meta<typeof DashboardReadinessDemo> = {
  title: 'Dashboard/DashboardReadiness',
  component: DashboardReadinessDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Page-like composite stories that show the dashboard banner + skill card grid together.
These demonstrate how the readiness system looks in context — progression banners with
defer buttons, maintenance banners with inline ReadinessReport, and skill cards with
readiness dots — all rendered in a realistic dashboard layout.
        `,
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DashboardReadinessDemo>

// ============================================================================
// Stories
// ============================================================================

export const ProgressionSoftNudge: Story = {
  name: 'Progression (Soft Nudge)',
  render: () => (
    <DashboardReadinessDemo
      sessionMode={mockProgressionSoftNudge}
      skills={mockSkills}
    />
  ),
}

export const MaintenanceDeferredPartial: Story = {
  name: 'Maintenance (Deferred - Partial Readiness)',
  render: () => (
    <DashboardReadinessDemo
      sessionMode={mockMaintenanceDeferredPartial}
      skills={mockSkills}
    />
  ),
}

export const MaintenanceDeferredAllSolid: Story = {
  name: 'Maintenance (Deferred - All Solid)',
  render: () => (
    <DashboardReadinessDemo
      sessionMode={mockMaintenanceDeferredAllMet}
      skills={allSolidSkills}
    />
  ),
}

export const PureMaintenanceAllSolid: Story = {
  name: 'Pure Maintenance (All Solid)',
  render: () => (
    <DashboardReadinessDemo
      sessionMode={mockPureMaintenance}
      skills={allSolidSkills}
    />
  ),
}

export const Remediation: Story = {
  name: 'Remediation (Blocked Promotion)',
  render: () => (
    <DashboardReadinessDemo
      sessionMode={mockRemediationBlocked}
      skills={mockSkills}
      badgeMap={{
        'tc.1': ['weak'],
      }}
    />
  ),
}

export const DarkModeDeferred: Story = {
  name: 'Dark Mode (Deferred Partial)',
  render: () => (
    <DashboardReadinessDemo
      sessionMode={mockMaintenanceDeferredPartial}
      skills={mockSkills}
      darkMode
    />
  ),
}

export const DarkModePureMaintenance: Story = {
  name: 'Dark Mode (Pure Maintenance)',
  render: () => (
    <DashboardReadinessDemo
      sessionMode={mockPureMaintenance}
      skills={allSolidSkills}
      darkMode
    />
  ),
}
