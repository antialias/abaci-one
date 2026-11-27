/**
 * The transition screen asks the part kinds how to show a part (Phase 5b):
 * label, emoji and whether it is worked on the physical abacus. For arithmetic
 * the answers must give exactly what the screen showed when it switched on the
 * part type itself.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SessionPartType } from '@/db/schema/session-plans'
import { PartTransitionScreen, partTransitionViewOf } from '../PartTransitionScreen'
import {
  requiresAbacusPickUp,
  requiresAbacusPutAway,
  selectTransitionMessage,
} from '../partTransitionMessages'

vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../hooks/usePartTransitionAudio', () => ({ usePartTransitionAudio: () => {} }))

const TYPES: SessionPartType[] = ['abacus', 'visualization', 'linear']
const view = (type: SessionPartType) => partTransitionViewOf({ type })

function renderScreen(previous: SessionPartType | null, next: SessionPartType, seed = 3) {
  return render(
    <PartTransitionScreen
      isVisible
      previous={previous ? view(previous) : null}
      next={view(next)}
      countdownStartTime={Date.now()}
      student={{ name: 'Kid', emoji: '🦊', color: 'blue' }}
      onComplete={() => {}}
      messageSeed={seed}
    />
  )
}

describe('PartTransitionScreen — the part kind answers', () => {
  it('asks arithmetic for its label and emoji', () => {
    expect(view('abacus')).toMatchObject({ kind: 'arithmetic', label: 'Abacus', emoji: '🧮' })
    expect(view('visualization')).toMatchObject({ label: 'Visualization', emoji: '🧠' })
    expect(view('linear')).toMatchObject({ label: 'Equations', emoji: '✏️' })
  })

  it('gives another kind a plain view and no abacus action', () => {
    expect(partTransitionViewOf({ kind: 'read-abacus' })).toEqual({
      kind: 'read-abacus',
      label: 'Next part',
      emoji: '⭐',
      needsPhysicalAbacus: false,
    })
  })

  for (const previous of [null, ...TYPES] as Array<SessionPartType | null>) {
    for (const next of TYPES) {
      it(`shows ${previous ?? 'start'} → ${next} as the type switch did`, () => {
        const { container, unmount } = renderScreen(previous, next)
        const root = container.querySelector('[data-component="part-transition-screen"]')
        expect(root).toHaveAttribute('data-previous-part', previous ?? 'start')
        expect(root).toHaveAttribute('data-next-part', next)

        const action = container.querySelector('[data-element="abacus-action"]')
        if (requiresAbacusPutAway(previous, next)) {
          expect(action).toHaveTextContent('Put your abacus aside')
        } else if (requiresAbacusPickUp(previous, next)) {
          expect(action).toHaveTextContent('Get your abacus ready')
        } else {
          expect(action).toBeNull()
        }

        expect(
          screen.getByText(selectTransitionMessage(previous, next, 3).headline)
        ).toBeInTheDocument()
        expect(screen.getByText(view(next).label)).toBeInTheDocument()
        unmount()
      })
    }
  }

  it('shows another kind with its own label, asking it whether the abacus goes away', () => {
    const { container } = render(
      <PartTransitionScreen
        isVisible
        previous={view('abacus')}
        next={partTransitionViewOf({ kind: 'read-abacus' })}
        countdownStartTime={Date.now()}
        student={{ name: 'Kid', emoji: '🦊', color: 'blue' }}
        onComplete={() => {}}
      />
    )
    expect(container.querySelector('[data-next-part="read-abacus"]')).toBeInTheDocument()
    expect(screen.getByText('Next Up!')).toBeInTheDocument()
    expect(container.querySelector('[data-element="abacus-action"]')).toHaveTextContent(
      'Put your abacus aside'
    )
  })
})
