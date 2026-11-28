/**
 * The transition screen asks the part kinds how to show a part (Phase 5b):
 * label and emoji. Whether the abacus comes or goes is the caller's
 * (`abacusNotice`, plan §8 A19): the screen shows the notice it is given,
 * and its messages never tell the kid what to do with the abacus.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SessionPartType } from '@/db/schema/session-plans'
import type { AbacusNotice } from '@/lib/curriculum/abacus-notice'
import { PartTransitionScreen, partTransitionViewOf } from '../PartTransitionScreen'
import { selectTransitionMessage } from '../partTransitionMessages'

vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../hooks/usePartTransitionAudio', () => ({ usePartTransitionAudio: () => {} }))

const TYPES: SessionPartType[] = ['abacus', 'visualization', 'linear']
const NOTICES: Array<AbacusNotice | null> = [null, 'pick_up', 'put_away']
const view = (type: SessionPartType) => partTransitionViewOf({ type })
const student = { name: 'Kid', emoji: '🦊', color: 'blue' }

function renderScreen(
  previous: SessionPartType | null,
  next: SessionPartType,
  abacusNotice: AbacusNotice | null,
  seed = 3
) {
  return render(
    <PartTransitionScreen
      isVisible
      previous={previous ? view(previous) : null}
      next={view(next)}
      abacusNotice={abacusNotice}
      countdownStartTime={Date.now()}
      student={student}
      onComplete={() => {}}
      messageSeed={seed}
    />
  )
}

describe('PartTransitionScreen — the part kind answers', () => {
  it('asks arithmetic for its label and emoji', () => {
    expect(view('abacus')).toEqual({
      kind: 'arithmetic',
      label: 'Abacus',
      emoji: '🧮',
      presentation: 'abacus',
    })
    expect(view('visualization')).toMatchObject({ label: 'Visualization', emoji: '🧠' })
    expect(view('linear')).toMatchObject({ label: 'Equations', emoji: '✏️' })
  })

  it('gives another kind a plain view', () => {
    expect(partTransitionViewOf({ kind: 'read-abacus' })).toEqual({
      kind: 'read-abacus',
      label: 'Next part',
      emoji: '⭐',
    })
  })

  for (const previous of [null, ...TYPES] as Array<SessionPartType | null>) {
    for (const next of TYPES) {
      for (const notice of NOTICES) {
        it(`shows ${previous ?? 'start'} → ${next} with notice ${notice ?? 'none'}`, () => {
          const { container, unmount } = renderScreen(previous, next, notice)
          const root = container.querySelector('[data-component="part-transition-screen"]')
          expect(root).toHaveAttribute('data-previous-part', previous ?? 'start')
          expect(root).toHaveAttribute('data-next-part', next)

          const action = container.querySelector('[data-element="abacus-action"]')
          if (notice === 'put_away') expect(action).toHaveTextContent('Put your abacus aside')
          else if (notice === 'pick_up') expect(action).toHaveTextContent('Get your abacus ready')
          else expect(action).toBeNull()

          expect(
            screen.getByText(selectTransitionMessage(previous, next, 3).headline)
          ).toBeInTheDocument()
          expect(screen.getByText(view(next).label)).toBeInTheDocument()
          unmount()
        })
      }
    }
  }

  it('never tells the kid what to do with the abacus between two parts (the notice does)', () => {
    for (const previous of TYPES) {
      for (const next of TYPES) {
        for (let seed = 0; seed < 10; seed++) {
          const { headline, subtitle } = selectTransitionMessage(previous, next, seed)
          expect(`${headline} ${subtitle ?? ''}`).not.toMatch(/abacus/i)
        }
      }
    }
  })

  it('shows another kind with its own label and the notice it is given', () => {
    const { container } = render(
      <PartTransitionScreen
        isVisible
        previous={view('abacus')}
        next={partTransitionViewOf({ kind: 'read-abacus' })}
        abacusNotice="put_away"
        countdownStartTime={Date.now()}
        student={student}
        onComplete={() => {}}
      />
    )
    expect(container.querySelector('[data-next-part="read-abacus"]')).toBeInTheDocument()
    expect(screen.getByText('Next Up!')).toBeInTheDocument()
    expect(container.querySelector('[data-element="abacus-action"]')).toHaveTextContent(
      'Put your abacus aside'
    )
  })

  it('the abacus-notice variant shows the notice alone, and Continue completes it', () => {
    const onComplete = vi.fn()
    const { container } = render(
      <PartTransitionScreen
        isVisible
        variant="abacus-notice"
        previous={view('abacus')}
        next={view('visualization')}
        abacusNotice="put_away"
        countdownStartTime={Date.now()}
        student={student}
        onComplete={onComplete}
      />
    )
    expect(container.querySelector('[data-component="part-transition-screen"]')).toBeNull()
    const root = container.querySelector('[data-component="abacus-notice-screen"]')
    expect(root).toHaveAttribute('data-next-part', 'visualization')
    expect(container.querySelector('[data-element="transition-message"]')).toBeNull()
    expect(container.querySelector('[data-element="abacus-action"]')).toHaveTextContent(
      'Put your abacus aside'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(container.querySelector('[data-action="continue-abacus-notice"]')).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
