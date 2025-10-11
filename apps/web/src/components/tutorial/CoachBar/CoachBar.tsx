'use client'

import type { PedagogicalSegment } from '../DecompositionWithReasons'
import { useTutorialUI } from '../TutorialUIContext'

export function CoachBar() {
  const ui = useTutorialUI()
  const seg: PedagogicalSegment | null = ui.activeSegment

  if (!ui.showCoachBar || !seg || !seg.readable?.summary) return null

  const r = seg.readable

  return (
    <aside className="coachbar" role="status" aria-live="polite" data-test-id="coachbar">
      <div className="coachbar__row">
        <div className="coachbar__title">{r.title ?? 'Step'}</div>
        {ui.canHideCoachBar && (
          <button
            type="button"
            className="coachbar__hide"
            onClick={() => ui.setShowCoachBar(false)}
            aria-label="Hide guidance"
          >
            ✕
          </button>
        )}
      </div>
      <p className="coachbar__summary">{r.summary}</p>
      {(r.chips?.length ?? 0) > 0 && (
        <div className="coachbar__chips">
          {r.chips.slice(0, 2).map((c, i) => (
            <span key={i} className="coachbar__chip">
              {c.label}: {c.value}
            </span>
          ))}
        </div>
      )}
    </aside>
  )
}
