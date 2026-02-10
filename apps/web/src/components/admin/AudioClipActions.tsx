'use client'

import { css } from '../../../styled-system/css'

interface AudioClipActionsProps {
  clipId: string
  isFlagged: boolean
  onToggleFlag: (clipId: string) => void
  onRegenerate: (clipId: string) => void
  isRegenerating: boolean
  compact?: boolean
}

export function AudioClipActions({
  clipId,
  isFlagged,
  onToggleFlag,
  onRegenerate,
  isRegenerating,
  compact = false,
}: AudioClipActionsProps) {
  const size = compact
    ? { fontSize: '11px', padding: '2px 8px' }
    : { fontSize: '13px', padding: '6px 12px' }

  return (
    <div
      data-component="AudioClipActions"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '4px' : '8px',
      })}
    >
      <button
        data-action="toggle-flag"
        onClick={() => onToggleFlag(clipId)}
        className={css({
          border: '1px solid #f85149',
          borderRadius: '6px',
          fontWeight: '600',
          cursor: 'pointer',
          backgroundColor: isFlagged ? '#f85149' : 'transparent',
          color: isFlagged ? '#fff' : '#f85149',
          '&:hover': { backgroundColor: isFlagged ? '#da3633' : '#f8514922' },
          ...size,
        })}
      >
        {isFlagged ? 'Unflag' : 'Flag'}
      </button>
      <button
        data-action="regenerate-clip"
        onClick={() => onRegenerate(clipId)}
        disabled={isRegenerating}
        className={css({
          border: 'none',
          borderRadius: '6px',
          fontWeight: '600',
          cursor: 'pointer',
          backgroundColor: '#238636',
          color: '#fff',
          '&:hover': { backgroundColor: '#2ea043' },
          '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
          ...size,
        })}
      >
        {compact ? 'Regen' : 'Regenerate'}
      </button>
    </div>
  )
}
