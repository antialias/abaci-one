'use client'

// Disclosure — a self-contained "Customize ▸/▾" collapsible for the dark studio
// rails (Gitea epic #5, full-bleed CP1a). Factored from the viewer's inline
// Customize toggle so the same primitive tucks away the design sliders, the print
// settings editor, and the marker sheet's "advanced" (laser SVG) section behind
// progressive disclosure. Owns its own open state; inline-styled to match the
// surrounding dark panels.

import { type ReactNode, useId, useState } from 'react'

export interface DisclosureProps {
  label: string
  children: ReactNode
  defaultOpen?: boolean
  dataElement?: string
  dataAction?: string
}

export function Disclosure({
  label,
  children,
  defaultOpen = false,
  dataElement = 'disclosure',
  dataAction = 'toggle-disclosure',
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  return (
    <div
      data-component="disclosure"
      data-element={dataElement}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <button
        type="button"
        data-action={dataAction}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 2px',
          border: 'none',
          background: 'transparent',
          color: 'rgba(203,213,225,0.9)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <span>{label}</span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div id={panelId} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  )
}
