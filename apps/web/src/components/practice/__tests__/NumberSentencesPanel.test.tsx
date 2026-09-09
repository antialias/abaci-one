/**
 * NumberSentencesPanel (dashboard Skills tab, tier 2 of the linear-readiness disclosure).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LinearReadinessState } from '@/hooks/useLinearReadiness'
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
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockReadiness.data = lockedState()
})

describe('NumberSentencesPanel', () => {
  it('renders nothing when the flag is off', () => {
    mockReadiness.data = { enabled: false, frontier: null, categories: [], skills: [] }
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
        'Number sentences unlock when your Basic Skills are quick and steady. 1 of 2 ready.'
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
})
