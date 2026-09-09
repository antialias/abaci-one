/**
 * NumberSentencesPanel (dashboard Skills tab, tier 2 of the linear-readiness disclosure).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LinearReadinessState } from '@/hooks/useLinearReadiness'
import type { LinearEntryAssessment } from '@/lib/curriculum/linear-entry-policy'
import type { SkillReadinessResult } from '@/lib/curriculum/skill-readiness'

const mockReadiness: { data: LinearReadinessState | undefined } = { data: undefined }
const mockClearVeto = { mutate: vi.fn(), isPending: false }

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))
vi.mock('@/hooks/useLinearReadiness', () => ({
  useLinearReadiness: () => mockReadiness,
  useLinearReadinessVeto: () => ({ clearVeto: mockClearVeto, setVeto: { mutate: vi.fn() } }),
}))

import { NumberSentencesPanel } from '../NumberSentencesPanel'

function readiness(skillId: string, solid: boolean): SkillReadinessResult {
  return {
    skillId,
    isSolid: solid,
    dimensions: {
      mastery: { met: solid, pKnown: solid ? 0.95 : 0.5, confidence: 0.6 },
      volume: { met: true, opportunities: 40, sessionCount: 5 },
      speed: { met: solid, medianSecondsPerTerm: solid ? 3 : 12 },
      consistency: { met: true, recentAccuracy: 0.9, lastFiveAllCorrect: true, recentHelpCount: 0 },
    },
  }
}

const BASIC_IDS = ['basic.directAddition', 'basic.heavenBead']

function entry(skillId: string, ready: boolean): LinearEntryAssessment {
  return {
    skillId,
    ready,
    advancesFrontier: true,
    opportunities: 40,
    mastery: { met: true, pKnown: 0.97 },
    volume: { met: true, opportunities: 40, sessionCount: 6, minOpportunities: 20 },
    accuracy: {
      met: ready,
      recentAccuracy: ready ? 0.93 : 0.73,
      windowFilled: 15,
      windowSize: 15,
      minAccuracy: 0.85,
      cleanStreak: false,
    },
    speed: { rule: 'off', met: true, secondsPerTerm: null, maxSecondsPerTerm: 5 },
  }
}

function lockedState(): LinearReadinessState {
  return {
    enabled: true,
    frontier: {
      rank: 0,
      category: 'basic',
      name: 'Basic Skills',
      skillIds: BASIC_IDS,
      solidCount: 1,
      total: 2,
    },
    categories: [
      {
        category: 'basic',
        name: 'Basic Skills',
        skillIds: BASIC_IDS,
        vetoed: false,
        status: 'locked',
      },
    ],
    skills: [
      {
        skillId: BASIC_IDS[0],
        name: 'Direct Addition',
        stage: 0,
        readiness: readiness(BASIC_IDS[0], true),
      },
      {
        skillId: BASIC_IDS[1],
        name: 'Heaven Bead',
        stage: 0,
        readiness: readiness(BASIC_IDS[1], false),
      },
    ],
    pending: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockReadiness.data = lockedState()
})

describe('NumberSentencesPanel', () => {
  it('renders nothing when the flag is off', () => {
    mockReadiness.data = { enabled: false, frontier: null, categories: [], skills: [], pending: [] }
    const { container } = render(<NumberSentencesPanel studentId="p1" isDark={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('locked: names the frontier, its progress, and a readiness row per frontier skill', () => {
    const { container } = render(<NumberSentencesPanel studentId="p1" isDark={false} />)
    const panel = container.querySelector('#number-sentences')
    expect(panel).not.toBeNull()
    expect(panel!.getAttribute('data-status')).toBe('locked')
    expect(screen.getByText('Number sentences')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Number sentences unlock when your Basic Skills are practiced and mastered. 1 of 2 there.'
      )
    ).toBeInTheDocument()
    const rows = container.querySelectorAll('[data-element="frontier-skill"]')
    expect(rows).toHaveLength(2)
    expect(screen.getByText('Direct Addition')).toBeInTheDocument()
    expect(screen.getByText('Heaven Bead')).toBeInTheDocument()
    // compact pills by default; tapping a row expands to the full report
    expect(container.querySelector('[data-component="readiness-report"]')).toBeNull()
    fireEvent.click(screen.getByText('Heaven Bead').closest('button')!)
    expect(container.querySelector('[data-component="readiness-report"]')).not.toBeNull()
  })

  it('ready: says which categories feed number sentences', () => {
    mockReadiness.data = {
      enabled: true,
      frontier: null,
      categories: [
        {
          category: 'basic',
          name: 'Basic Skills',
          skillIds: BASIC_IDS,
          vetoed: false,
          status: 'ready',
        },
      ],
      skills: [],
      pending: [],
    }
    const { container } = render(<NumberSentencesPanel studentId="p1" isDark={false} />)
    expect(container.querySelector('#number-sentences')!.getAttribute('data-status')).toBe('ready')
    expect(screen.getByText(/Basic Skills is ready for number sentences/)).toBeInTheDocument()
  })

  it('vetoed: shows the "not yet" and Undo lifts the veto', () => {
    mockReadiness.data = {
      ...lockedState(),
      categories: [
        {
          category: 'basic',
          name: 'Basic Skills',
          skillIds: BASIC_IDS,
          vetoed: true,
          status: 'vetoed',
        },
      ],
    }
    render(<NumberSentencesPanel studentId="p1" isDark={false} />)
    expect(
      screen.getByText("You said 'not yet' to number sentences for Basic Skills.")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(mockClearVeto.mutate).toHaveBeenCalledWith({ category: 'basic' })
  })

  it('entry verdicts: frontier rows use advancesFrontier, and settling skills list past the frontier', () => {
    const base = lockedState()
    mockReadiness.data = {
      ...base,
      skills: [
        { ...base.skills[0], entry: entry(BASIC_IDS[0], true) },
        {
          ...base.skills[1],
          readiness: readiness(BASIC_IDS[1], false),
          entry: entry(BASIC_IDS[1], false),
        },
      ],
      pending: [
        {
          skillId: 'fiveComplements.4=5-1',
          name: 'Five Complement 4',
          stage: 1,
          readiness: readiness('fiveComplements.4=5-1', false),
          entry: entry('fiveComplements.4=5-1', false),
        },
      ],
    }
    const { container } = render(<NumberSentencesPanel studentId="p1" isDark={false} />)
    const frontierRows = container.querySelectorAll(
      '[data-element="frontier-skill-list"] [data-element="frontier-skill"]'
    )
    expect(frontierRows).toHaveLength(2)
    // Heaven Bead is not "solid" by the generic assessment but does advance the frontier
    expect(frontierRows[1].getAttribute('data-solid')).toBe('true')
    expect(frontierRows[1].getAttribute('data-ready')).toBe('false')
    expect(frontierRows[0].getAttribute('data-ready')).toBe('true')

    expect(screen.getByText('Almost there: 1 skill still settling')).toBeInTheDocument()
    const pendingRows = container.querySelectorAll(
      '[data-element="pending-skill-list"] [data-element="frontier-skill"]'
    )
    expect(pendingRows).toHaveLength(1)
    expect(screen.getByText('Five Complement 4')).toBeInTheDocument()
    expect(screen.getAllByText('accuracy: 73% over last 15, need 85%')).toHaveLength(2)

    fireEvent.click(screen.getByText('Five Complement 4').closest('button')!)
    const report = pendingRows[0].querySelector('[data-element="linear-entry-report"]')
    expect(report).not.toBeNull()
    expect(report!.querySelector('[data-dimension="accuracy"]')!.getAttribute('data-met')).toBe(
      'false'
    )
    expect(report!.querySelector('[data-dimension="speed"]')).toBeNull()
  })
})
