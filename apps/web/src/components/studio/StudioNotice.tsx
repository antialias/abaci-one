'use client'

// StudioNotice — the studio's one way of saying something went sideways
// (Gitea #43). A tone is a 3 px left bar on a tinted wash, NOT an outlined box:
// the rails already carry cards, controls and a mapping table, and a fifth
// bordered rectangle on top of those reads as more chrome rather than as an
// interruption. The bar is the interruption; the wash is the scope.
//
// Use this rather than the `notice()` fragment when the message has a title, or
// actions, or both — the fragment alone is for one-liners.
//
// `role` defaults by tone: ok/info/warn are `status` (polite — a warn notice
// stays up for as long as a setting is wrong and often re-renders as a slider
// moves, so it must never interrupt), danger is `alert` (assertive — a one-shot
// failure). Callers override either way: a danger box that recomputes with the
// design (a solver refusal) passes `role="status"`.

import type { ReactNode } from 'react'
import { notice, STUDIO, type StudioTone } from './theme'

export interface StudioNoticeProps {
  tone: StudioTone
  children: ReactNode
  title?: ReactNode
  /** buttons — use `button('fix')` so they read as neutral on the tone wash */
  actions?: ReactNode
  dataElement?: string
  role?: string
}

const DEFAULT_ROLE: Record<StudioTone, string> = {
  ok: 'status',
  info: 'status',
  warn: 'status',
  danger: 'alert',
}

export function StudioNotice({
  tone,
  children,
  title,
  actions,
  dataElement = 'studio-notice',
  role,
}: StudioNoticeProps) {
  return (
    <div
      data-component="studio-notice"
      data-element={dataElement}
      data-tone={tone}
      role={role ?? DEFAULT_ROLE[tone]}
      style={notice(tone)}
    >
      {title != null && (
        <div style={{ ...STUDIO.type.strong, color: 'inherit', marginBottom: 4 }}>{title}</div>
      )}
      <div>{children}</div>
      {actions != null && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{actions}</div>
      )}
    </div>
  )
}
