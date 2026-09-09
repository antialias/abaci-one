'use client'

// StudioShell — the full-bleed, docked-rail frame for the Abacus Studio (Gitea
// epic #5, full-bleed CP1a). Modeled on the worksheets ResponsivePanelLayout
// (react-resizable-panels + collapsible rails); the two converge on a shared
// primitive in CP5. "Fixed rails" here means NOT re-dockable — resize + collapse
// are in scope.
//
// The load-bearing rule (§3.1): the CENTER slot is where the mount-once three.js
// canvas lives, so it is rendered in a stable position and only the RAILS change
// between the desktop docked panels and the mobile drawer (where both rails move
// off the canvas into a FAB-opened MobileDrawer). Crossing the mobile breakpoint
// still swaps the surrounding tree, but post-CP0 that only rebuilds the transient
// WebGL scene — the design state survives in the provider. A canvas portal is the
// CP5 escape hatch if a residual remount ever bites.
//
// The right rail is optional: the paper lane passes `right={null}` so no
// fabrication column (and, upstream, no three.js) is mounted at all.

import { css } from '@styled/css'
import { type CSSProperties, type ReactNode, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { MobileDrawer } from '@/components/shared/MobileDrawer'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { STUDIO } from './theme'

export interface StudioShellProps {
  left: ReactNode
  center: ReactNode
  /** null on the paper/express lane → no fabrication rail is mounted */
  right?: ReactNode | null
  /**
   * Persistent bar pinned above the center on EVERY breakpoint — the studio's
   * headline control (the fabrication switch). Kept out of the rails so it never
   * hides in the mobile drawer; sits directly over the canvas as the "what am I
   * making?" header.
   */
  toolbar?: ReactNode | null
  autoSaveId?: string
}

// THE SHELL IS THE ONE STUDIO FILE PANDA COMPILES, and Panda extracts at BUILD
// time from LITERALS: `css({ bg: STUDIO.color.rail })` reaches the extractor as
// an expression it cannot fold, so the rule is silently dropped and the rail
// loses its background (verified with `panda debug`). A module constant does not
// help — it is still an import away from a literal.
//
// So the shell publishes theme.ts's chrome colours as custom properties on its
// root and the css() calls name them. The values still live in exactly one
// place, and `_hover` — which an inline style cannot express — still works.
const SHELL_VARS = {
  '--studio-rail': STUDIO.color.rail,
  '--studio-bg': STUDIO.color.bg,
  '--studio-hairline': STUDIO.color.hairline,
  '--studio-grip': STUDIO.color.grip,
  '--studio-accent-hover': STUDIO.color.accentHover,
  '--studio-on-accent': STUDIO.color.onAccent,
  '--studio-accent-gradient': STUDIO.gradient.accent,
  '--studio-fab-shadow': STUDIO.shadow.fab,
  // the FAB names the rails it opens, so it wears the rail heading's size
  '--studio-fab-size': `${STUDIO.type.heading.fontSize}px`,
} as CSSProperties

const HAIRLINE = '1px solid var(--studio-hairline)'

// The mobile affordance for the docked rails: on small screens the canvas owns
// the whole viewport and the rails live in a slide-in drawer, opened by this
// floating button. (Its counterpart on the worksheets layout is a draggable,
// summary-bearing FAB coupled to that feature; the studio's is deliberately
// plain — one tap to the same rails the desktop docks.)
//
// Anchored bottom-LEFT on purpose: the global MyAbacus dock is fixed bottom-right
// (z-102), so a right-anchored FAB collides with it. Left also matches the drawer
// it opens, which slides in from the left — the control lives at its own origin.
function StudioRailFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-component="studio-rail-fab"
      data-action="open-studio-rails"
      onClick={onClick}
      aria-label="Open design controls"
      className={css({
        position: 'fixed',
        left: '16px',
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        px: '16px',
        py: '12px',
        borderRadius: 'full',
        border: 'none',
        color: 'var(--studio-on-accent)',
        fontSize: 'var(--studio-fab-size)',
        fontWeight: 700,
        cursor: 'pointer',
        background: 'var(--studio-accent-gradient)',
        boxShadow: 'var(--studio-fab-shadow)',
      })}
    >
      <span aria-hidden="true">⚙</span>
      Design
    </button>
  )
}

function StudioResizeHandle() {
  return (
    <PanelResizeHandle
      className={css({
        width: '10px',
        position: 'relative',
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bg: 'var(--studio-bg)',
        borderLeft: HAIRLINE,
        borderRight: HAIRLINE,
        transition: 'background-color 0.15s',
        _hover: { bg: 'var(--studio-accent-hover)' },
      })}
    >
      <div
        aria-hidden="true"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          pointerEvents: 'none',
        })}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={css({
              width: '3px',
              height: '3px',
              borderRadius: 'full',
              bg: 'var(--studio-grip)',
            })}
          />
        ))}
      </div>
    </PanelResizeHandle>
  )
}

// The persistent header bar that hosts the toolbar slot, above the canvas on
// both layouts. Centered so a capped-width control (the fabrication switch)
// reads as a deliberate header rather than a stretched strip.
const toolbarBar = css({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  px: '12px',
  py: '10px',
  bg: 'var(--studio-bg)',
  borderBottom: HAIRLINE,
})

export function StudioShell({
  left,
  center,
  right = null,
  toolbar = null,
  autoSaveId = 'abacus-studio-layout',
}: StudioShellProps) {
  const isMobile = useIsMobile()
  const [railsOpen, setRailsOpen] = useState(false)
  const railScroll = css({ h: 'full', overflow: 'auto', bg: 'var(--studio-rail)' })
  // The global MyAbacus dock is fixed bottom-RIGHT at z-102 and floats over this
  // rail — 100 px of button plus its 24 px inset on md+ — so without a floor of
  // padding it eats the last control in the column (the print submit, or a file
  // download). Only the right rail is under it; the left one is clear.
  const rightRailScroll = css({
    h: 'full',
    overflow: 'auto',
    bg: 'var(--studio-rail)',
    pb: '124px',
  })

  if (isMobile) {
    // Small screens: the canvas (or marker sheet) owns the whole viewport as the
    // stable center, and both docked rails move into a slide-in drawer reached by
    // the FAB. Crossing the breakpoint swaps the surrounding tree, but post-CP0
    // that only rebuilds the transient WebGL scene — the design lives in the
    // provider. The rails are wrapped in a forced-dark surface so they stay
    // legible whatever the app theme paints the drawer chrome.
    return (
      <div
        data-component="studio-shell"
        data-mobile="true"
        style={SHELL_VARS}
        className={css({
          position: 'relative',
          h: 'full',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        })}
      >
        {toolbar != null && (
          <div data-element="studio-toolbar" className={toolbarBar}>
            {toolbar}
          </div>
        )}

        <div
          data-element="studio-canvas-slot"
          className={css({ position: 'relative', flex: 1, minHeight: 0 })}
        >
          {center}
        </div>

        <StudioRailFab onClick={() => setRailsOpen(true)} />

        <MobileDrawer isOpen={railsOpen} onClose={() => setRailsOpen(false)}>
          <div
            data-element="studio-rails-mobile"
            className={css({
              display: 'flex',
              flexDirection: 'column',
              bg: 'var(--studio-rail)',
              borderRadius: 'md',
              overflow: 'hidden',
            })}
          >
            <div data-element="studio-rail-left">{left}</div>
            {right != null && (
              <div data-element="studio-rail-right" className={css({ borderTop: HAIRLINE })}>
                {right}
              </div>
            )}
          </div>
        </MobileDrawer>
      </div>
    )
  }

  return (
    <div
      data-component="studio-shell"
      style={SHELL_VARS}
      className={css({ h: 'full', minHeight: 0 })}
    >
      <PanelGroup direction="horizontal" autoSaveId={autoSaveId} className={css({ h: 'full' })}>
        <Panel id="left" order={1} defaultSize={24} minSize={16} maxSize={38} collapsible>
          <div data-element="studio-rail-left" className={railScroll}>
            {left}
          </div>
        </Panel>

        <StudioResizeHandle />

        <Panel id="center" order={2} minSize={38}>
          <div
            className={css({
              h: 'full',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            })}
          >
            {toolbar != null && (
              <div data-element="studio-toolbar" className={toolbarBar}>
                {toolbar}
              </div>
            )}
            <div
              data-element="studio-canvas-slot"
              className={css({ flex: 1, minHeight: 0, position: 'relative' })}
            >
              {center}
            </div>
          </div>
        </Panel>

        {right != null && <StudioResizeHandle />}
        {right != null && (
          <Panel id="right" order={3} defaultSize={28} minSize={20} maxSize={42} collapsible>
            <div data-element="studio-rail-right" className={rightRailScroll}>
              {right}
            </div>
          </Panel>
        )}
      </PanelGroup>
    </div>
  )
}
