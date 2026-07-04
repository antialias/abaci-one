import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { AffectedSession } from '@/lib/curriculum/timing/pace-estimation'
import { ReviewTimingsQuietLink, TimingDataNoticeView } from '../TimingDataNotice'

// next/link needs the app-router context; for a pure-presentation test we only
// care that it renders an anchor with the right href, so stub it to one.
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const STUDENT = 'stu-1'

function session(id: string): AffectedSession {
  return { sessionId: id, completedAt: null, flaggedCount: 1, worstSeconds: 120 }
}

type ViewProps = Parameters<typeof TimingDataNoticeView>[0]

function renderNotice(overrides: Partial<ViewProps> = {}) {
  const props: ViewProps = {
    studentId: STUDENT,
    unresolvedCount: 0,
    tier1Count: 0,
    tier2Count: 0,
    estimatedProblems: 20,
    estimatedProblemsIfRepaired: null,
    affectedSessions: [],
    isDark: false,
    ...overrides,
  }
  return render(<TimingDataNoticeView {...props} />)
}

describe('TimingDataNoticeView', () => {
  it('renders nothing when there are no unresolved flagged timings', () => {
    const { container } = renderNotice({ unresolvedCount: 0, tier2Count: 3 })
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the amber Tier-2 notice with the if-repaired preview', () => {
    renderNotice({
      unresolvedCount: 3,
      tier2Count: 3,
      estimatedProblems: 12,
      estimatedProblemsIfRepaired: 20,
      affectedSessions: [session('a'), session('b')],
    })

    const el = document.querySelector('[data-component="timing-data-notice"]')!
    expect(el.getAttribute('data-tier')).toBe('tier2')
    expect(el.getAttribute('data-flag-count')).toBe('3')

    expect(screen.getByText(/3 unusually long timings/)).toBeInTheDocument()
    // Repaired preview: ~20 instead of ~12.
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('pluralizes a single Tier-2 timing', () => {
    renderNotice({ unresolvedCount: 1, tier2Count: 1, estimatedProblems: 10 })
    expect(screen.getByText(/1 unusually long timing\./)).toBeInTheDocument()
  })

  it('hides the repair preview when the repaired count matches the current one', () => {
    renderNotice({
      unresolvedCount: 2,
      tier2Count: 2,
      estimatedProblems: 15,
      estimatedProblemsIfRepaired: 15,
    })
    expect(screen.queryByText(/would hold about/)).not.toBeInTheDocument()
  })

  it('renders the neutral Tier-1-only notice (estimate already protected)', () => {
    renderNotice({ unresolvedCount: 2, tier1Count: 2, tier2Count: 0 })
    const el = document.querySelector('[data-component="timing-data-notice"]')!
    expect(el.getAttribute('data-tier')).toBe('tier1')
    expect(screen.getByText(/set aside automatically, so this estimate is protected/)).toBeInTheDocument()
    // Neutral variant uses the short "Review →" affordance.
    expect(screen.getByText('Review →')).toBeInTheDocument()
  })

  it('appends the Tier-1 note when both tiers are present', () => {
    renderNotice({
      unresolvedCount: 3,
      tier1Count: 1,
      tier2Count: 2,
      estimatedProblems: 12,
      estimatedProblemsIfRepaired: 18,
    })
    expect(screen.getByText(/1 broken measurement was already set aside automatically\./)).toBeInTheDocument()
  })

  it('focuses a single affected session in the review link', () => {
    renderNotice({ unresolvedCount: 1, tier2Count: 1, affectedSessions: [session('only-one')] })
    const link = document.querySelector('[data-action="review-timings"]')!
    expect(link.getAttribute('href')).toBe(
      `/practice/${STUDENT}/review-timings?session=only-one`
    )
  })

  it('opens the full review list when multiple sessions are affected', () => {
    renderNotice({
      unresolvedCount: 2,
      tier2Count: 2,
      affectedSessions: [session('a'), session('b')],
    })
    const link = document.querySelector('[data-action="review-timings"]')!
    expect(link.getAttribute('href')).toBe(`/practice/${STUDENT}/review-timings`)
  })
})

describe('ReviewTimingsQuietLink', () => {
  it('links to the player-level review page (proactive, no session focus)', () => {
    render(<ReviewTimingsQuietLink studentId={STUDENT} isDark={false} />)
    const link = document.querySelector('[data-component="review-timings-quiet-link"]')!
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe(`/practice/${STUDENT}/review-timings`)
    expect(link.getAttribute('data-action')).toBe('review-timings')
    expect(screen.getByText(/Review timing data/)).toBeInTheDocument()
  })
})
