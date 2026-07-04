/**
 * Tests for LinearGraduationBanner (L3).
 *
 * The proactive "these skills are ready for number sentences" nudge shown above
 * the practice-modes bar. Verifies the render gate (only when linear is off and
 * there are non-vetoed ready categories) and the two actions (turn on = raise
 * linear weight; not yet = veto the shown categories).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { LinearReadinessState } from '@/hooks/useLinearReadiness'

const mockCtx = {
  studentId: 'p1',
  partWeights: { abacus: 2, visualization: 1, linear: 0 },
  cyclePartWeight: vi.fn(),
}
const mockReadiness: { data: LinearReadinessState | undefined } = { data: undefined }
const mockSetVeto = { mutate: vi.fn(), isPending: false }

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))
vi.mock('../../StartPracticeModalContext', () => ({
  useStartPracticeModal: () => mockCtx,
}))
vi.mock('@/hooks/useLinearReadiness', () => ({
  useLinearReadiness: () => mockReadiness,
  useLinearReadinessVeto: () => ({ setVeto: mockSetVeto }),
}))

import { LinearGraduationBanner } from '../LinearGraduationBanner'

function cat(category: string, name: string, vetoed = false) {
  return { category, name, skillIds: [`${category}.x`], vetoed }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.partWeights = { abacus: 2, visualization: 1, linear: 0 }
  mockSetVeto.isPending = false
  mockReadiness.data = { enabled: true, categories: [cat('basic', 'Basic')] }
})

describe('LinearGraduationBanner', () => {
  it('renders the nudge when linear is off and a category is ready', () => {
    const { container } = render(<LinearGraduationBanner />)
    expect(
      container.querySelector('[data-element="linear-graduation-banner"]')
    ).not.toBeNull()
    expect(screen.getByText('Ready for number sentences')).toBeInTheDocument()
    expect(screen.getByText('Basic')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /turn on number sentences/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /not yet/i })).toBeInTheDocument()
  })

  it('renders nothing when linear is already on', () => {
    mockCtx.partWeights = { abacus: 2, visualization: 1, linear: 1 }
    const { container } = render(<LinearGraduationBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when every ready category is vetoed', () => {
    mockReadiness.data = { enabled: true, categories: [cat('basic', 'Basic', true)] }
    const { container } = render(<LinearGraduationBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the flag is off (no data / no categories)', () => {
    mockReadiness.data = undefined
    const { container } = render(<LinearGraduationBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('"Turn on number sentences" raises the linear weight', () => {
    render(<LinearGraduationBanner />)
    fireEvent.click(screen.getByRole('button', { name: /turn on number sentences/i }))
    expect(mockCtx.cyclePartWeight).toHaveBeenCalledWith('linear')
  })

  it('"Not yet" vetoes every shown category', () => {
    mockReadiness.data = {
      enabled: true,
      categories: [cat('basic', 'Basic'), cat('fiveComplements', 'Five Complements')],
    }
    render(<LinearGraduationBanner />)
    fireEvent.click(screen.getByRole('button', { name: /not yet/i }))
    expect(mockSetVeto.mutate).toHaveBeenCalledTimes(2)
    expect(mockSetVeto.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'basic' })
    )
    expect(mockSetVeto.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'fiveComplements' })
    )
  })

  it('lists multiple ready categories with an and-joined phrase', () => {
    mockReadiness.data = {
      enabled: true,
      categories: [cat('basic', 'Basic'), cat('fiveComplements', 'Five Complements')],
    }
    render(<LinearGraduationBanner />)
    // "Basic and Five Complements" appears (split across <strong>), so match loosely.
    expect(screen.getByText(/Basic/)).toBeInTheDocument()
    expect(screen.getByText(/Five Complements/)).toBeInTheDocument()
    expect(screen.getByText(/are automatic enough/i)).toBeInTheDocument()
  })
})
