'use client'

// The studio's ambient design→filament reconciliation (Gitea epic #5), reality-
// first. The 3D model previews what will actually PRINT (the loaded filament
// colors); THIS strip shows the same reality as swatches. Each swatch's base is
// the filament a role prints on; when that differs noticeably from the color the
// user designed, a corner fleck of their *true* color appears (see
// `reconciledRoles` / `SHIFT_DISTANCE_THRESHOLD`). Hovering that fleck momentarily
// flips the whole model to the user's designed colors (`onRevealIntrinsic`).
// Clicking a swatch opens that role's picker (the parent's `revealRole` deep
// link). When everything prints true there are no flecks — the strip is just the
// plate.

import type { CSSProperties } from 'react'
import type { FilamentCatalog } from './abacus-catalog'
import { type PrintPlan, reconciledRoles } from './abacus-plan'

export interface FilamentReconcileStripProps {
  plan: PrintPlan
  catalog: FilamentCatalog
  onPickRole: (roleKey: string) => void
  /** hover the true-color fleck → preview the designed colors on the 3D model */
  onRevealIntrinsic?: (reveal: boolean) => void
}

export function FilamentReconcileStrip({
  plan,
  catalog,
  onPickRole,
  onRevealIntrinsic,
}: FilamentReconcileStripProps) {
  const roles = reconciledRoles(plan, catalog)
  // one spool → nothing to choose, so the swatches are informational, not buttons
  const interactive = catalog.spools.length > 1
  const shiftCount = roles.filter((r) => r.shifted).length
  const loaded = catalog.spools.length

  return (
    <div
      data-component="filament-reconcile-strip"
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      // safety: never leave the model stuck in the reveal lens if a fleck's
      // mouseleave is missed (e.g. the pointer exits the strip diagonally)
      onMouseLeave={() => onRevealIntrinsic?.(false)}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {roles.map((r) => {
          const tip = r.shifted
            ? `${r.label}: prints ${r.filamentName} — your color ${r.intrinsicHex} (hover the corner to preview)`
            : `${r.label}: prints true (${r.filamentName})`
          const swatchStyle: CSSProperties = {
            position: 'relative',
            width: 34,
            height: 34,
            padding: 0,
            border: 'none',
            borderRadius: 9,
            overflow: 'hidden',
            // reality-first: the swatch shows the FILAMENT the role prints on
            background: r.filamentHex,
            cursor: interactive ? 'pointer' : 'default',
            boxShadow: r.overridden
              ? 'inset 0 0 0 1px rgba(255,255,255,0.16), 0 0 0 2px rgba(103,232,249,0.9)'
              : r.shifted
                ? 'inset 0 0 0 1px rgba(255,255,255,0.24)'
                : 'inset 0 0 0 1px rgba(255,255,255,0.10)',
          }
          return (
            <span key={r.key} title={tip} style={{ display: 'inline-flex' }}>
              <button
                type="button"
                data-element="filament-reconcile-swatch"
                data-action="open-filament-picker"
                data-role={r.key}
                data-shifted={r.shifted}
                aria-label={tip}
                disabled={!interactive}
                onClick={interactive ? () => onPickRole(r.key) : undefined}
                style={swatchStyle}
              >
                {r.shifted && (
                  // the corner fleck is the user's TRUE (designed) color; hovering
                  // it previews the designed colors on the model
                  <span
                    aria-hidden="true"
                    data-element="filament-reconcile-fleck"
                    onMouseEnter={() => onRevealIntrinsic?.(true)}
                    onMouseLeave={() => onRevealIntrinsic?.(false)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      width: 0,
                      height: 0,
                      borderStyle: 'solid',
                      borderWidth: '0 0 16px 16px',
                      borderColor: `transparent transparent ${r.intrinsicHex} transparent`,
                    }}
                  />
                )}
              </button>
            </span>
          )
        })}
      </div>

      <div
        data-element="filament-reconcile-caption"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <span style={{ color: 'rgba(148,163,184,0.9)' }}>
          {loaded} filament{loaded === 1 ? '' : 's'} loaded
        </span>
        <span
          data-element="filament-reconcile-status"
          style={{ color: shiftCount > 0 ? 'rgba(251,191,36,0.92)' : 'rgba(148,163,184,0.7)' }}
        >
          {shiftCount > 0
            ? `${shiftCount} color${shiftCount === 1 ? '' : 's'} shift`
            : 'prints true'}
        </span>
      </div>
    </div>
  )
}
