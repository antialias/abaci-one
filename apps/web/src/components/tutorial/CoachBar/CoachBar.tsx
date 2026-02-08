'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useAudioHelp } from '@/contexts/AudioHelpContext'
import type { PedagogicalSegment } from '../DecompositionWithReasons'
import { useTutorialUI } from '../TutorialUIContext'

export function CoachBar() {
  const ui = useTutorialUI()
  const t = useTranslations('tutorial.coachBar')
  const { isEnabled: audioHelpEnabled } = useAudioHelp()
  const seg: PedagogicalSegment | null = ui.activeSegment
  const lastSummaryRef = useRef<string>('')

  // Read coach hint aloud via browser SpeechSynthesis when it changes
  const summary = seg?.readable?.summary
  useEffect(() => {
    if (!audioHelpEnabled || !summary || summary === lastSummaryRef.current) return
    lastSummaryRef.current = summary
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(summary)
      utterance.rate = 0.9
      speechSynthesis.cancel()
      speechSynthesis.speak(utterance)
    }
  }, [audioHelpEnabled, summary])

  if (!ui.showCoachBar || !seg || !seg.readable?.summary) return null

  const r = seg.readable

  return (
    <aside className="coachbar" role="status" aria-live="polite" data-test-id="coachbar">
      <div className="coachbar__row">
        <div className="coachbar__title">{r.title ?? t('titleFallback')}</div>
        {ui.canHideCoachBar && (
          <button
            type="button"
            className="coachbar__hide"
            onClick={() => ui.setShowCoachBar(false)}
            aria-label={t('hideAria')}
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
