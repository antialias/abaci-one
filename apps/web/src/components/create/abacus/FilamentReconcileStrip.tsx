'use client'

// The studio's ambient design→filament reconciliation (Gitea epic #5). Replaces
// the old "My colors / Print preview" toggle: the 3D model always keeps the
// user's designed colors, and THIS strip whispers how those colors land on the
// filament actually loaded. Each swatch is a designed color; a role only earns a
// corner fleck of its filament when it prints as a *different* color (see
// `reconciledRoles` / `SHIFT_DISTANCE_THRESHOLD`). When everything prints true the
// strip is just the user's palette — nothing to read. Clicking a swatch opens
// that role's picker (the parent's `revealRole` deep link).

import type { CSSProperties } from 'react'
import type { FilamentCatalog } from './abacus-catalog'
import { type PrintPlan, reconciledRoles } from './abacus-plan'

export interface FilamentReconcileStripProps {
  plan: PrintPlan
  catalog: FilamentCatalog
  onPickRole: (roleKey: string) => void
}

export function FilamentReconcileStrip({ plan, catalog, onPickRole }: FilamentReconcileStripProps) {
  const roles = reconciledRoles(plan, catalog)
  // one spool → nothing to choose, so the swatches are informational, not buttons
  const interactive = catalog.spools.length > 1
  const shiftCount = roles.filter((r) => r.shifted).length
  const loaded = catalog.spools.length

  return (
    <div
      data-component="filament-reconcile-strip"
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {roles.map((r) => {
          const tip = r.shifted
            ? `${r.label}: your ${r.intrinsicHex} prints as ${r.filamentName}`
            : `${r.label}: prints true (${r.filamentName})`
          const swatchStyle: CSSProperties = {
            position: 'relative',
            width: 34,
            height: 34,
            padding: 0,
            border: 'none',
            borderRadius: 9,
            overflow: 'hidden',
            background: r.intrinsicHex,
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
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      width: 0,
                      height: 0,
                      borderStyle: 'solid',
                      borderWidth: '0 0 15px 15px',
                      borderColor: `transparent transparent ${r.filamentHex} transparent`,
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
