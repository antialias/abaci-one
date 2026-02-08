import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionModeBanner } from '../SessionModeBanner'
import type {
  RemediationMode,
  ProgressionMode,
  MaintenanceMode,
  SessionMode,
} from '@/lib/curriculum/session-mode'
import type { SkillReadinessResult } from '@/lib/curriculum/skill-readiness'

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}))

// Mock Panda CSS
vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

// Mock ReadinessReport
vi.mock('../ReadinessReport', () => ({
  ReadinessReport: ({
    readiness,
    variant,
  }: {
    readiness: Record<string, SkillReadinessResult>
    variant: string
  }) =>
    React.createElement('div', {
      'data-testid': 'readiness-report',
      'data-variant': variant,
      'data-skills': Object.keys(readiness).join(','),
    }),
}))

// ============================================================================
// Fixtures
// ============================================================================

function createRemediationMode(
  overrides: Partial<RemediationMode> = {}
): RemediationMode {
  return {
    type: 'remediation',
    weakSkills: [
      { skillId: 'basic.+3', displayName: '+3', pKnown: 0.35 },
      { skillId: 'basic.+4', displayName: '+4', pKnown: 0.45 },
    ],
    focusDescription: 'Strengthening +3, +4',
    ...overrides,
  }
}

function createProgressionMode(
  overrides: Partial<ProgressionMode> = {}
): ProgressionMode {
  return {
    type: 'progression',
    nextSkill: { skillId: 'heaven.5', displayName: '+5 (Heaven Bead)', pKnown: 0 },
    phase: { id: 'phase2', name: 'Heaven Bead', primarySkillId: 'heaven.5' } as any,
    tutorialRequired: true,
    skipCount: 0,
    focusDescription: 'Ready to learn +5',
    canSkipTutorial: true,
    ...overrides,
  }
}

function createMaintenanceMode(
  overrides: Partial<MaintenanceMode> = {}
): MaintenanceMode {
  return {
    type: 'maintenance',
    focusDescription: 'All skills strong',
    skillCount: 12,
    ...overrides,
  }
}

// ============================================================================
// Remediation Banner
// ============================================================================

describe('SessionModeBanner - Remediation', () => {
  it('renders remediation banner with data attributes', () => {
    const onAction = vi.fn()
    render(
      <SessionModeBanner sessionMode={createRemediationMode()} onAction={onAction} />
    )
    const banner = document.querySelector('[data-mode="remediation"]')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveAttribute('data-variant', 'dashboard')
  })

  it('shows "Strengthening skills" heading without blocked promotion', () => {
    render(
      <SessionModeBanner
        sessionMode={createRemediationMode()}
        onAction={vi.fn()}
      />
    )
    expect(screen.getByText('Strengthening skills')).toBeInTheDocument()
  })

  it('shows weak skill names as targeting', () => {
    render(
      <SessionModeBanner
        sessionMode={createRemediationMode()}
        onAction={vi.fn()}
      />
    )
    // The text "Targeting: " is followed by strong elements
    expect(screen.getByText('+3, +4')).toBeInTheDocument()
  })

  it('shows "Almost there!" with blocked promotion', () => {
    const mode = createRemediationMode({
      blockedPromotion: {
        nextSkill: { skillId: 'heaven.5', displayName: '+5', pKnown: 0 },
        reason: 'Strengthen prerequisites',
        phase: { id: 'p2', name: 'Heaven', primarySkillId: 'heaven.5' } as any,
        tutorialReady: false,
      },
    })
    render(<SessionModeBanner sessionMode={mode} onAction={vi.fn()} />)
    expect(screen.getByText('Almost there!')).toBeInTheDocument()
  })

  it('shows blocked promotion next skill name', () => {
    const mode = createRemediationMode({
      blockedPromotion: {
        nextSkill: { skillId: 'heaven.5', displayName: '+5 (Heaven)', pKnown: 0 },
        reason: 'Strengthen prerequisites',
        phase: { id: 'p2', name: 'Heaven', primarySkillId: 'heaven.5' } as any,
        tutorialReady: false,
      },
    })
    render(<SessionModeBanner sessionMode={mode} onAction={vi.fn()} />)
    expect(screen.getByText('+5 (Heaven)')).toBeInTheDocument()
  })

  it('shows progress bar with blocked promotion', () => {
    const mode = createRemediationMode({
      weakSkills: [{ skillId: 'basic.+3', displayName: '+3', pKnown: 0.35 }],
      blockedPromotion: {
        nextSkill: { skillId: 'heaven.5', displayName: '+5', pKnown: 0 },
        reason: 'Strengthen prerequisites',
        phase: { id: 'p2', name: 'Heaven', primarySkillId: 'heaven.5' } as any,
        tutorialReady: false,
      },
    })
    render(<SessionModeBanner sessionMode={mode} onAction={vi.fn()} />)
    // Progress percent = Math.round((0.35 / 0.5) * 100) = 70
    expect(screen.getByText('70%')).toBeInTheDocument()
  })

  it('calls onAction when Practice Now button is clicked', () => {
    const onAction = vi.fn()
    render(
      <SessionModeBanner sessionMode={createRemediationMode()} onAction={onAction} />
    )
    const button = document.querySelector('[data-action="start-remediation"]') as HTMLElement
    expect(button).toBeInTheDocument()
    fireEvent.click(button)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('shows "Practice Now →" on button', () => {
    render(
      <SessionModeBanner sessionMode={createRemediationMode()} onAction={vi.fn()} />
    )
    expect(screen.getByText('Practice Now →')).toBeInTheDocument()
  })

  it('shows "Starting..." when loading', () => {
    render(
      <SessionModeBanner
        sessionMode={createRemediationMode()}
        onAction={vi.fn()}
        isLoading={true}
      />
    )
    expect(screen.getByText('Starting...')).toBeInTheDocument()
  })

  it('disables button when loading', () => {
    render(
      <SessionModeBanner
        sessionMode={createRemediationMode()}
        onAction={vi.fn()}
        isLoading={true}
      />
    )
    const button = document.querySelector('[data-action="start-remediation"]') as HTMLButtonElement
    expect(button).toBeDisabled()
  })

  it('uses modal variant', () => {
    render(
      <SessionModeBanner
        sessionMode={createRemediationMode()}
        onAction={vi.fn()}
        variant="modal"
      />
    )
    const banner = document.querySelector('[data-mode="remediation"]')
    expect(banner).toHaveAttribute('data-variant', 'modal')
  })

  it('limits displayed weak skills to 3', () => {
    const mode = createRemediationMode({
      weakSkills: [
        { skillId: 'basic.+1', displayName: '+1', pKnown: 0.3 },
        { skillId: 'basic.+2', displayName: '+2', pKnown: 0.35 },
        { skillId: 'basic.+3', displayName: '+3', pKnown: 0.4 },
        { skillId: 'basic.+4', displayName: '+4', pKnown: 0.45 },
      ],
    })
    render(<SessionModeBanner sessionMode={mode} onAction={vi.fn()} />)
    // Only first 3 should be displayed
    expect(screen.getByText('+1, +2, +3')).toBeInTheDocument()
  })
})

// ============================================================================
// Progression Banner
// ============================================================================

describe('SessionModeBanner - Progression', () => {
  it('renders progression banner with data attributes', () => {
    render(
      <SessionModeBanner sessionMode={createProgressionMode()} onAction={vi.fn()} />
    )
    const banner = document.querySelector('[data-mode="progression"]')
    expect(banner).toBeInTheDocument()
  })

  it('shows next skill name', () => {
    render(
      <SessionModeBanner sessionMode={createProgressionMode()} onAction={vi.fn()} />
    )
    expect(screen.getByText('+5 (Heaven Bead)')).toBeInTheDocument()
  })

  it('shows "Tutorial available when ready" when tutorialRequired', () => {
    render(
      <SessionModeBanner
        sessionMode={createProgressionMode({ tutorialRequired: true })}
        onAction={vi.fn()}
      />
    )
    expect(screen.getByText('Tutorial available when ready')).toBeInTheDocument()
  })

  it('shows "Continue building mastery" when tutorial not required', () => {
    render(
      <SessionModeBanner
        sessionMode={createProgressionMode({ tutorialRequired: false })}
        onAction={vi.fn()}
      />
    )
    expect(screen.getByText('Continue building mastery')).toBeInTheDocument()
  })

  it('has keep practicing button', () => {
    render(
      <SessionModeBanner sessionMode={createProgressionMode()} onAction={vi.fn()} />
    )
    const button = document.querySelector('[data-action="start-maintenance"]') as HTMLElement
    expect(button).toBeInTheDocument()
    expect(screen.getByText('Keep practicing current skills')).toBeInTheDocument()
  })

  it('has start learning button with skill name', () => {
    render(
      <SessionModeBanner sessionMode={createProgressionMode()} onAction={vi.fn()} />
    )
    const button = document.querySelector('[data-action="start-progression"]') as HTMLElement
    expect(button).toBeInTheDocument()
    expect(
      screen.getByText('Start learning +5 (Heaven Bead) →')
    ).toBeInTheDocument()
  })

  it('calls onAction when clicking start learning', () => {
    const onAction = vi.fn()
    render(
      <SessionModeBanner sessionMode={createProgressionMode()} onAction={onAction} />
    )
    const button = document.querySelector('[data-action="start-progression"]') as HTMLElement
    fireEvent.click(button)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('calls onAction when clicking keep practicing', () => {
    const onAction = vi.fn()
    render(
      <SessionModeBanner sessionMode={createProgressionMode()} onAction={onAction} />
    )
    const button = document.querySelector('[data-action="start-maintenance"]') as HTMLElement
    fireEvent.click(button)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('shows defer button when onDefer provided', () => {
    const onDefer = vi.fn()
    render(
      <SessionModeBanner
        sessionMode={createProgressionMode()}
        onAction={vi.fn()}
        onDefer={onDefer}
      />
    )
    const deferButton = document.querySelector(
      '[data-action="defer-progression"]'
    ) as HTMLElement
    expect(deferButton).toBeInTheDocument()
    expect(screen.getByText('Not yet, ask again later')).toBeInTheDocument()
  })

  it('calls onDefer when clicking defer button', () => {
    const onDefer = vi.fn()
    render(
      <SessionModeBanner
        sessionMode={createProgressionMode()}
        onAction={vi.fn()}
        onDefer={onDefer}
      />
    )
    const deferButton = document.querySelector(
      '[data-action="defer-progression"]'
    ) as HTMLElement
    fireEvent.click(deferButton)
    expect(onDefer).toHaveBeenCalledTimes(1)
  })

  it('does not show defer button when onDefer not provided', () => {
    render(
      <SessionModeBanner sessionMode={createProgressionMode()} onAction={vi.fn()} />
    )
    expect(
      document.querySelector('[data-action="defer-progression"]')
    ).not.toBeInTheDocument()
  })

  it('shows "Starting..." on both buttons when loading', () => {
    render(
      <SessionModeBanner
        sessionMode={createProgressionMode()}
        onAction={vi.fn()}
        isLoading={true}
      />
    )
    const startingTexts = screen.getAllByText('Starting...')
    expect(startingTexts).toHaveLength(2) // both buttons
  })
})

// ============================================================================
// Maintenance Banner
// ============================================================================

describe('SessionModeBanner - Maintenance', () => {
  it('renders maintenance banner with data attributes', () => {
    render(
      <SessionModeBanner sessionMode={createMaintenanceMode()} onAction={vi.fn()} />
    )
    const banner = document.querySelector('[data-mode="maintenance"]')
    expect(banner).toBeInTheDocument()
  })

  it('shows "All skills strong!" without deferred progression', () => {
    render(
      <SessionModeBanner sessionMode={createMaintenanceMode()} onAction={vi.fn()} />
    )
    expect(screen.getByText('All skills strong!')).toBeInTheDocument()
  })

  it('shows skill count in message', () => {
    render(
      <SessionModeBanner
        sessionMode={createMaintenanceMode({ skillCount: 8 })}
        onAction={vi.fn()}
      />
    )
    expect(
      screen.getByText('Keep practicing to maintain mastery (8 skills)')
    ).toBeInTheDocument()
  })

  it('shows working toward skill with deferred progression', () => {
    const mode = createMaintenanceMode({
      deferredProgression: {
        nextSkill: { skillId: 'heaven.5', displayName: '+5 (Heaven)', pKnown: 0 },
        readiness: {
          'basic.+3': {
            skillId: 'basic.+3',
            isSolid: false,
            dimensions: {
              mastery: { met: true, pKnown: 0.9, confidence: 0.8 },
              volume: { met: true, opportunities: 25, sessionCount: 5 },
              speed: { met: false, medianSecondsPerTerm: 5.0 },
              consistency: { met: true, recentAccuracy: 0.9, lastFiveAllCorrect: true, recentHelpCount: 0 },
            },
          },
        },
        phase: { id: 'p2', name: 'Heaven', primarySkillId: 'heaven.5' } as any,
      },
    })
    render(<SessionModeBanner sessionMode={mode} onAction={vi.fn()} />)
    expect(screen.getByText('Working toward: +5 (Heaven)')).toBeInTheDocument()
    expect(
      screen.getByText('Building muscle memory before advancing')
    ).toBeInTheDocument()
  })

  it('renders ReadinessReport when deferred progression exists', () => {
    const mode = createMaintenanceMode({
      deferredProgression: {
        nextSkill: { skillId: 'heaven.5', displayName: '+5', pKnown: 0 },
        readiness: {
          'basic.+3': {
            skillId: 'basic.+3',
            isSolid: false,
            dimensions: {
              mastery: { met: true, pKnown: 0.9, confidence: 0.8 },
              volume: { met: true, opportunities: 25, sessionCount: 5 },
              speed: { met: false, medianSecondsPerTerm: 5.0 },
              consistency: { met: true, recentAccuracy: 0.9, lastFiveAllCorrect: true, recentHelpCount: 0 },
            },
          },
        },
        phase: { id: 'p2', name: 'Heaven', primarySkillId: 'heaven.5' } as any,
      },
    })
    render(<SessionModeBanner sessionMode={mode} onAction={vi.fn()} />)
    const report = screen.getByTestId('readiness-report')
    expect(report).toBeInTheDocument()
    expect(report).toHaveAttribute('data-variant', 'full')
  })

  it('calls onAction when Practice button is clicked', () => {
    const onAction = vi.fn()
    render(
      <SessionModeBanner sessionMode={createMaintenanceMode()} onAction={onAction} />
    )
    const button = document.querySelector(
      '[data-action="start-maintenance"]'
    ) as HTMLElement
    fireEvent.click(button)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('shows "Practice →" on button', () => {
    render(
      <SessionModeBanner sessionMode={createMaintenanceMode()} onAction={vi.fn()} />
    )
    expect(screen.getByText('Practice →')).toBeInTheDocument()
  })

  it('shows "Starting..." when loading', () => {
    render(
      <SessionModeBanner
        sessionMode={createMaintenanceMode()}
        onAction={vi.fn()}
        isLoading={true}
      />
    )
    expect(screen.getByText('Starting...')).toBeInTheDocument()
  })

  it('disables button when loading', () => {
    render(
      <SessionModeBanner
        sessionMode={createMaintenanceMode()}
        onAction={vi.fn()}
        isLoading={true}
      />
    )
    const button = document.querySelector(
      '[data-action="start-maintenance"]'
    ) as HTMLButtonElement
    expect(button).toBeDisabled()
  })
})

// ============================================================================
// Defaults
// ============================================================================

describe('SessionModeBanner - defaults', () => {
  it('defaults isLoading to false', () => {
    render(
      <SessionModeBanner sessionMode={createRemediationMode()} onAction={vi.fn()} />
    )
    expect(screen.getByText('Practice Now →')).toBeInTheDocument()
    expect(screen.queryByText('Starting...')).not.toBeInTheDocument()
  })

  it('defaults variant to dashboard', () => {
    render(
      <SessionModeBanner sessionMode={createRemediationMode()} onAction={vi.fn()} />
    )
    const banner = document.querySelector('[data-mode="remediation"]')
    expect(banner).toHaveAttribute('data-variant', 'dashboard')
  })
})
