'use client'

// Disclosure — a self-contained "Customize ▸/▾" collapsible for the dark studio
// rails (Gitea epic #5, full-bleed CP1a). Factored from the viewer's inline
// Customize toggle so the same primitive tucks away the design sliders, the print
// settings editor, and the marker sheet's "advanced" (vector SVG) section behind
// progressive disclosure. Styled from theme.ts: the header wears the same ruled
// eyebrow as StudioSection's, so an open section and a closed fold read as one
// ladder and the only thing the difference carries is "you probably want this"
// vs "ask for it".
//
// Open state is uncontrolled by default and controlled when `open` is passed —
// PrintPanel needs to read whether the settings are showing (the floating rail
// widens for them) without a second copy of the state.
//
// `keepMounted` is the print-settings editor's requirement, not a nicety: that
// editor is expensive to build and holds unsaved edits, so it must not mount
// before someone asks for it and must not unmount when they fold it away. The
// children therefore mount on FIRST open and then stay, hidden with `hidden` +
// `display: none`. This replaces PrintPanel's hand-rolled `settingsEverOpened`.

import { type ReactNode, useId, useState } from 'react'
import { EYEBROW_RULED, STUDIO } from './theme'

export interface DisclosureProps {
  label: string
  children: ReactNode
  defaultOpen?: boolean
  /** controlled mode — when set, `open` wins and `onOpenChange` is the only writer */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** mount the children on first open and keep them mounted (hidden) after */
  keepMounted?: boolean
  dataElement?: string
  dataAction?: string
}

export function Disclosure({
  label,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  keepMounted = false,
  dataElement = 'disclosure',
  dataAction = 'toggle-disclosure',
}: DisclosureProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : uncontrolledOpen
  // `keepMounted` only has to remember that it has been open once; after that
  // the panel is in the tree for good.
  const [everOpened, setEverOpened] = useState(defaultOpen)
  const panelId = useId()

  const toggle = () => {
    const next = !open
    if (!controlled) setUncontrolledOpen(next)
    if (next) setEverOpened(true)
    onOpenChange?.(next)
  }

  const mounted = open || (keepMounted && everOpened)

  return (
    <div
      data-component="disclosure"
      data-element={dataElement}
      style={{ display: 'flex', flexDirection: 'column', gap: STUDIO.space.section }}
    >
      <button
        type="button"
        data-action={dataAction}
        aria-expanded={open}
        aria-controls={mounted ? panelId : undefined}
        onClick={toggle}
        style={{
          ...EYEBROW_RULED,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          border: 'none',
          borderBottom: EYEBROW_RULED.borderBottom,
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span>{label}</span>
        <span aria-hidden="true" style={{ color: STUDIO.color.muted }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {mounted && (
        <div
          id={panelId}
          hidden={!open}
          style={{
            display: open ? 'flex' : 'none',
            flexDirection: 'column',
            gap: STUDIO.space.section,
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
