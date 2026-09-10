/**
 * LinearLockNote: the popover copy for a locked Linear segment, and the
 * "See what's needed" deep link that has to close the modal it lives in
 * (the link targets the dashboard the modal is usually mounted on).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LinearReadinessState } from '@/hooks/useLinearReadiness'
import { describeLinearLock, LinearLockNote, numberSentencesPanelHref } from '../LinearLockNote'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

function state(overrides: Partial<LinearReadinessState> = {}): LinearReadinessState {
  return {
    enabled: true,
    frontier: {
      category: 'basic',
      rank: 0,
      name: 'Basic Skills',
      skillIds: [],
      solidCount: 1,
      total: 6,
    },
    categories: [
      { category: 'basic', name: 'Basic Skills', skillIds: [], status: 'locked', vetoed: false },
    ],
    skills: [],
    pending: [],
    ...overrides,
  }
}

describe('LinearLockNote', () => {
  it('names the frontier stage and how close it is', () => {
    expect(describeLinearLock(state())).toBe(
      'Number sentences unlock when your Basic Skills are practiced and mastered. 1 of 6 there.'
    )
  })

  it('prefers the veto explanation when the teacher said "not yet"', () => {
    const s = state({
      categories: [
        { category: 'basic', name: 'Basic Skills', skillIds: [], status: 'vetoed', vetoed: true },
      ],
    })
    expect(describeLinearLock(s)).toBe("You said 'not yet' to number sentences for Basic Skills.")
  })

  it('links to the Skills tab panel and closes the modal on tap', () => {
    const onNavigate = vi.fn()
    render(<LinearLockNote state={state()} studentId="s1" isDark={false} onNavigate={onNavigate} />)
    const link = screen.getByRole('link', { name: "See what's needed" })
    expect(link).toHaveAttribute('href', numberSentencesPanelHref('s1'))
    expect(link).toHaveAttribute('href', '/practice/s1/dashboard?tab=skills#number-sentences')
    fireEvent.click(link)
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })
})
