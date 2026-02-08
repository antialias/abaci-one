import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReadinessReport } from '../ReadinessReport'
import type { SkillReadinessResult } from '@/lib/curriculum/skill-readiness'
import { READINESS_THRESHOLDS } from '@/lib/curriculum/config/readiness-thresholds'

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

// ============================================================================
// Helpers
// ============================================================================

function createReadinessResult(
  overrides: Partial<SkillReadinessResult> = {}
): SkillReadinessResult {
  return {
    skillId: 'basic.+3',
    isSolid: false,
    dimensions: {
      mastery: { met: false, pKnown: 0.6, confidence: 0.4 },
      volume: { met: false, opportunities: 10, sessionCount: 2 },
      speed: { met: false, medianSecondsPerTerm: 5.0 },
      consistency: { met: false, recentAccuracy: 0.7, lastFiveAllCorrect: false, recentHelpCount: 1 },
    },
    ...overrides,
  }
}

function createSolidResult(skillId = 'basic.+3'): SkillReadinessResult {
  return {
    skillId,
    isSolid: true,
    dimensions: {
      mastery: { met: true, pKnown: 0.9, confidence: 0.8 },
      volume: { met: true, opportunities: 25, sessionCount: 5 },
      speed: { met: true, medianSecondsPerTerm: 2.5 },
      consistency: { met: true, recentAccuracy: 0.95, lastFiveAllCorrect: true, recentHelpCount: 0 },
    },
  }
}

// ============================================================================
// Full variant tests
// ============================================================================

describe('ReadinessReport - full variant', () => {
  it('renders nothing when readiness is empty', () => {
    const { container } = render(<ReadinessReport readiness={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders four dimension lines', () => {
    const readiness = { 'basic.+3': createReadinessResult() }
    render(<ReadinessReport readiness={readiness} variant="full" />)

    const lines = screen.getByTestId
      ? document.querySelectorAll('[data-element="dimension-line"]')
      : document.querySelectorAll('[data-element="dimension-line"]')
    expect(lines).toHaveLength(4)
  })

  it('shows volume dimension with encouragement when unmet', () => {
    const readiness = {
      'basic.+3': createReadinessResult({
        dimensions: {
          mastery: { met: true, pKnown: 0.9, confidence: 0.8 },
          volume: { met: false, opportunities: 10, sessionCount: 2 },
          speed: { met: true, medianSecondsPerTerm: 2.5 },
          consistency: { met: true, recentAccuracy: 0.95, lastFiveAllCorrect: true, recentHelpCount: 0 },
        },
      }),
    }
    render(<ReadinessReport readiness={readiness} />)
    expect(
      screen.getByText(
        `10/${READINESS_THRESHOLDS.minOpportunities} problems practiced \u2014 almost there!`
      )
    ).toBeInTheDocument()
  })

  it('shows volume dimension without encouragement when met', () => {
    const readiness = {
      'basic.+3': createReadinessResult({
        dimensions: {
          mastery: { met: true, pKnown: 0.9, confidence: 0.8 },
          volume: { met: true, opportunities: 25, sessionCount: 5 },
          speed: { met: true, medianSecondsPerTerm: 2.5 },
          consistency: { met: true, recentAccuracy: 0.95, lastFiveAllCorrect: true, recentHelpCount: 0 },
        },
      }),
    }
    render(<ReadinessReport readiness={readiness} />)
    expect(
      screen.getByText(
        `25 problems practiced (need ${READINESS_THRESHOLDS.minOpportunities})`
      )
    ).toBeInTheDocument()
  })

  it('shows speed dimension with actual value when data exists', () => {
    const readiness = {
      'basic.+3': createReadinessResult({
        dimensions: {
          mastery: { met: true, pKnown: 0.9, confidence: 0.8 },
          volume: { met: true, opportunities: 25, sessionCount: 5 },
          speed: { met: false, medianSecondsPerTerm: 5.0 },
          consistency: { met: true, recentAccuracy: 0.95, lastFiveAllCorrect: true, recentHelpCount: 0 },
        },
      }),
    }
    render(<ReadinessReport readiness={readiness} />)
    expect(
      screen.getByText(
        /5\.0s per step.*need under.*4.*s.*getting faster/
      )
    ).toBeInTheDocument()
  })

  it('shows speed dimension no data message when null', () => {
    const readiness = {
      'basic.+3': createReadinessResult({
        dimensions: {
          mastery: { met: true, pKnown: 0.9, confidence: 0.8 },
          volume: { met: true, opportunities: 25, sessionCount: 5 },
          speed: { met: false, medianSecondsPerTerm: null },
          consistency: { met: true, recentAccuracy: 0.95, lastFiveAllCorrect: true, recentHelpCount: 0 },
        },
      }),
    }
    render(<ReadinessReport readiness={readiness} />)
    expect(
      screen.getByText(/No speed data yet.*getting faster/)
    ).toBeInTheDocument()
  })

  it('shows mastery dimension label', () => {
    const readiness = { 'basic.+3': createReadinessResult() }
    render(<ReadinessReport readiness={readiness} />)
    expect(
      screen.getByText(
        `Mastery at 60% (need ${Math.round(READINESS_THRESHOLDS.pKnownThreshold * 100)}%) \u2014 building understanding!`
      )
    ).toBeInTheDocument()
  })

  it('shows consistency dimension label', () => {
    const readiness = { 'basic.+3': createReadinessResult() }
    render(<ReadinessReport readiness={readiness} />)
    expect(
      screen.getByText(
        `70% accuracy over last ${READINESS_THRESHOLDS.accuracyWindowSize} problems \u2014 keep practicing!`
      )
    ).toBeInTheDocument()
  })

  it('marks met dimensions with data-met=true', () => {
    const readiness = { 'basic.+3': createSolidResult() }
    render(<ReadinessReport readiness={readiness} />)

    const lines = document.querySelectorAll('[data-element="dimension-line"]')
    for (const line of lines) {
      expect(line).toHaveAttribute('data-met', 'true')
    }
  })

  it('marks unmet dimensions with data-met=false', () => {
    const readiness = { 'basic.+3': createReadinessResult() }
    render(<ReadinessReport readiness={readiness} />)

    const lines = document.querySelectorAll('[data-element="dimension-line"]')
    for (const line of lines) {
      expect(line).toHaveAttribute('data-met', 'false')
    }
  })

  it('aggregates worst values across multiple skills', () => {
    const readiness = {
      'basic.+3': createSolidResult('basic.+3'),
      'basic.+4': createReadinessResult({
        skillId: 'basic.+4',
        dimensions: {
          mastery: { met: false, pKnown: 0.5, confidence: 0.3 },
          volume: { met: false, opportunities: 5, sessionCount: 1 },
          speed: { met: false, medianSecondsPerTerm: 6.0 },
          consistency: { met: false, recentAccuracy: 0.6, lastFiveAllCorrect: false, recentHelpCount: 2 },
        },
      }),
    }
    render(<ReadinessReport readiness={readiness} />)

    // Should use worst values: opportunities=5, pKnown=50%, accuracy=60%
    expect(screen.getByText(/5\/20 problems practiced/)).toBeInTheDocument()
    expect(screen.getByText(/Mastery at 50%/)).toBeInTheDocument()
    expect(screen.getByText(/60% accuracy/)).toBeInTheDocument()
  })
})

// ============================================================================
// Compact variant tests
// ============================================================================

describe('ReadinessReport - compact variant', () => {
  it('renders nothing when readiness is empty', () => {
    const { container } = render(<ReadinessReport readiness={{}} variant="compact" />)
    expect(container.firstChild).toBeNull()
  })

  it('shows "Solid" when all dimensions are met', () => {
    const readiness = { 'basic.+3': createSolidResult() }
    render(<ReadinessReport readiness={readiness} variant="compact" />)
    expect(screen.getByText('Solid')).toBeInTheDocument()
  })

  it('shows "X/4 solid" when some dimensions are unmet', () => {
    const readiness = {
      'basic.+3': createReadinessResult({
        dimensions: {
          mastery: { met: true, pKnown: 0.9, confidence: 0.8 },
          volume: { met: true, opportunities: 25, sessionCount: 5 },
          speed: { met: false, medianSecondsPerTerm: 5.0 },
          consistency: { met: false, recentAccuracy: 0.7, lastFiveAllCorrect: false, recentHelpCount: 1 },
        },
      }),
    }
    render(<ReadinessReport readiness={readiness} variant="compact" />)
    expect(screen.getByText('2/4 solid')).toBeInTheDocument()
  })

  it('shows "0/4 solid" when no dimensions are met', () => {
    const readiness = { 'basic.+3': createReadinessResult() }
    render(<ReadinessReport readiness={readiness} variant="compact" />)
    expect(screen.getByText('0/4 solid')).toBeInTheDocument()
  })

  it('renders readiness-badge element', () => {
    const readiness = { 'basic.+3': createSolidResult() }
    render(<ReadinessReport readiness={readiness} variant="compact" />)
    const badge = document.querySelector('[data-element="readiness-badge"]')
    expect(badge).toBeInTheDocument()
  })
})

// ============================================================================
// Default variant
// ============================================================================

describe('ReadinessReport - default variant', () => {
  it('defaults to full variant', () => {
    const readiness = { 'basic.+3': createReadinessResult() }
    render(<ReadinessReport readiness={readiness} />)
    // Full variant renders dimension lines, compact does not
    const lines = document.querySelectorAll('[data-element="dimension-line"]')
    expect(lines.length).toBeGreaterThan(0)
  })
})
