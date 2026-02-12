'use client'

import { css } from '../../../styled-system/css'
import { useAudioManager } from '@/hooks/useAudioManager'

export function SubtitleOverlay() {
  const { subtitleText } = useAudioManager()

  if (!subtitleText) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-component="SubtitleOverlay"
      className={css({
        position: 'fixed',
        bottom: '64px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '90vw',
        padding: '12px 24px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        borderRadius: '8px',
        fontSize: '18px',
        lineHeight: '1.5',
        textAlign: 'center',
        zIndex: 1000,
        pointerEvents: 'none',
      })}
    >
      {subtitleText}
    </div>
  )
}
