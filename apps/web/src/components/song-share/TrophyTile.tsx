/**
 * One celebration stat tile — the value pops, the label whispers, the tone
 * picks the gradient. Used by the public song-share page to render the
 * accuracy / problems / streak / age stats that the share's privacy toggles
 * permitted (none of these render unless the corresponding `show*` flag was
 * enabled — gating happens in `getSharedSong`).
 *
 * Visually a soft gradient card with a top-left glyph and a big numeric.
 * Tones map to the brand-extended celebration palette agreed in the
 * song-share redesign plan.
 */

import type { ReactNode } from 'react'
import { css } from '../../../styled-system/css'

export type TrophyTone = 'emerald' | 'sky' | 'amber' | 'rose'

interface TrophyTileProps {
  tone: TrophyTone
  glyph: string
  value: ReactNode
  label: string
}

interface ToneStyles {
  gradient: string
  border: string
  glyph: string
  value: string
  label: string
}

const TONES: Record<TrophyTone, ToneStyles> = {
  emerald: {
    gradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    glyph: '#10b981',
    value: '#047857',
    label: '#065f46',
  },
  sky: {
    gradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    glyph: '#3b82f6',
    value: '#1d4ed8',
    label: '#1e40af',
  },
  amber: {
    gradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    glyph: '#d97706',
    value: '#b45309',
    label: '#92400e',
  },
  rose: {
    gradient: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
    border: '1px solid rgba(244, 63, 94, 0.25)',
    glyph: '#e11d48',
    value: '#be123c',
    label: '#9f1239',
  },
}

export function TrophyTile({ tone, glyph, value, label }: TrophyTileProps) {
  const t = TONES[tone]
  return (
    <div
      data-component="trophy-tile"
      data-tone={tone}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        borderRadius: '16px',
        padding: '14px 16px',
        minW: '120px',
        boxShadow: '0 2px 10px rgba(124, 58, 237, 0.06)',
      })}
      style={{
        background: t.gradient,
        border: t.border,
      }}
    >
      <div
        aria-hidden="true"
        className={css({ fontSize: '20px', lineHeight: 1 })}
        style={{ color: t.glyph }}
      >
        {glyph}
      </div>
      <div
        className={css({
          fontFamily: 'display',
          fontWeight: 700,
          fontSize: '30px',
          lineHeight: 1.05,
          fontVariantNumeric: 'tabular-nums',
        })}
        style={{ color: t.value }}
      >
        {value}
      </div>
      <div
        className={css({
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
        })}
        style={{ color: t.label }}
      >
        {label}
      </div>
    </div>
  )
}
