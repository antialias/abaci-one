// Abacus Studio — the print-reduction panel (gh#163).
//
// Everything the user sees about the design→filament quantization: the
// loaded-spool legend (family-clustered), the plan warning strip with per-role
// remediation chips + fix-by-unpin, and the filament-mapping accordion with its
// co-print-grouped picker. Extracted from AbacusStudioViewer so it stays
// presentational — no network, no three.js, no React Query — and Storybook can
// drive it with fabricated catalogs (FilamentPlanPanel.stories.tsx).
//
// The parent owns `overrides` because the recolor pipeline needs the same pins;
// this panel re-derives the plan via materialize(design, catalog, { overrides }).
// materialize is pure, so the panel and the parent's recolor agree by
// construction — keep the options object in lockstep if it ever grows.

import {
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  coPrintGroup,
  type FilamentCatalog,
  type FilamentSpool,
  isSupportMaterial,
} from './abacus-catalog'
import type { AbacusDesign } from './abacus-design'
import { materialize, type RoleAssignment } from './abacus-plan'
import { FilamentReconcileStrip } from './FilamentReconcileStrip'

// gh#163 UX: mapping rows truncate spool names, and every spool from one brand
// starts with the same words ("Bambu Lab …") — the ellipsis was eating exactly
// the distinguishing tokens. The longest word-boundary prefix shared by the
// whole catalog is brand noise; row displays drop it, tooltips keep the full name.
function sharedNamePrefix(names: string[]): string {
  if (names.length < 2) return ''
  let prefix = names[0]
  for (const n of names) {
    while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1)
  }
  const cut = prefix.lastIndexOf(' ')
  return cut > 0 ? prefix.slice(0, cut + 1) : ''
}

// One section of the role picker's swatch grid (gh#163 Layer 2): swatches
// bucketed by co-print (plate-temperature) group around the plan's anchor.
type PickerSection = {
  key: string
  label: string | null
  dim: boolean
  spools: { spool: FilamentSpool; idx: number }[]
}

// Warnings that name individual roles a user can act on get a chip row that
// deep-links into the mapping panel. budget-exceeded stays prose: its roleKeys
// are every bead (a catalog-size reality, not a per-role mistake).
const CHIP_WARNING_CODES = new Set([
  'marker-contrast',
  'material-mix',
  'support-material',
  'material-interface',
])

// filament-mapping panel — a calm summary at rest, one inline picker at a time.
// Section eyebrow above each role group (beads first, structure below).
const GROUP_LABEL: CSSProperties = {
  fontSize: 9.5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 700,
  color: 'rgba(148,163,184,0.9)',
  padding: '6px 6px 2px',
}
const RESET_BTN: CSSProperties = {
  padding: '3px 8px',
  borderRadius: 5,
  border: '1px solid rgba(148,163,184,0.5)',
  background: 'transparent',
  color: 'rgba(226,232,240,1)',
  fontSize: 11,
  cursor: 'pointer',
}
// Hover/focus + the one-at-a-time reveal, plus the reduced-motion opt-out — none
// of which inline styles can express. Namespaced (abx-) so it can't collide.
const MAPPING_CSS = `
.abx-map-row { background: transparent; transition: background 120ms ease; }
.abx-map-row:hover { background: rgba(255,255,255,0.05); }
.abx-map-row:focus-visible { outline: 2px solid rgba(103,232,249,0.9); outline-offset: -2px; }
.abx-swatch:focus-visible { outline: 2px solid rgba(103,232,249,0.9); outline-offset: 2px; }
.abx-chevron { transition: transform 120ms ease; }
.abx-reveal { animation: abxReveal 140ms ease; }
@keyframes abxReveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .abx-map-row, .abx-chevron, .abx-reveal { transition: none; animation: none; }
}
`

export interface FilamentPlanPanelProps {
  /** the intrinsic design being reduced (colors as the user built them) */
  design: AbacusDesign
  /** the loaded spools the design quantizes onto (THH AMS or params-derived) */
  catalog: FilamentCatalog
  /** manual pins, roleKey → spoolId — parent-owned so its recolor sees them too */
  overrides: Record<string, string>
  onOverridesChange: Dispatch<SetStateAction<Record<string, string>>>
  /** initial disclosure state — lets stories and deep links render pre-opened */
  defaultMappingOpen?: boolean
  defaultOpenRole?: string | null
  /** hover the strip's true-color fleck → preview designed colors on the 3D model */
  onRevealIntrinsic?: (reveal: boolean) => void
}

export function FilamentPlanPanel({
  design,
  catalog,
  overrides,
  onOverridesChange: setOverrides,
  defaultMappingOpen = false,
  defaultOpenRole = null,
  onRevealIntrinsic,
}: FilamentPlanPanelProps) {
  // the design projected onto the loaded filaments, honoring the user's pins —
  // the source of truth for every warning and row below
  const plan = useMemo(
    () => materialize(design, catalog, { overrides }),
    [design, catalog, overrides]
  )
  // roleKey → the spool auto-snap PREFERS, ignoring the user's pins: the
  // closest color inside the plate's co-print anchor group (gh#163). The picker
  // badges this so someone who has pinned a worse-matching filament still sees
  // the recommendation, and the warning strip's Fix button restores it (the
  // solver is pin-blind, so un-pinned roles always sit on this pick already).
  // Depends only on design + catalog, so a pin doesn't recompute it.
  const preferredByRole = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of materialize(design, catalog).assignments) m.set(a.role.key, a.spoolIndex)
    return m
  }, [design, catalog])
  // the lossy-reduction heads-up shown in print mode: contrast the camera can't
  // read, a palette that outruns the loaded spools, and the material trio a pin
  // can raise (gh#163) — a plate split across temperature families, a visible
  // part on breakaway support media, a mixed-material frame/marker weld. The
  // per-role collision detail lives in the filament-mapping panel below.
  const reductionWarnings = plan.warnings.filter(
    (w) =>
      w.code === 'marker-contrast' ||
      w.code === 'budget-exceeded' ||
      w.code === 'material-mix' ||
      w.code === 'support-material' ||
      w.code === 'material-interface'
  )
  // override rows, grouped frame → ArUco pair → beads. `activeOverrides` counts
  // pins that actually took (an ignored, unloaded-spool pin has overridden=false).
  const orderedAssignments = useMemo(() => {
    const order = { frame: 0, markerBlack: 1, markerWhite: 2, bead: 3, text: 4 } as const
    return [...plan.assignments].sort((a, b) => order[a.role.kind] - order[b.role.kind])
  }, [plan])
  const activeOverrides = plan.assignments.filter((a) => a.overridden).length
  // grouped for the panel: beads first (what users actually tweak), then the
  // welded structure (frame + ArUco markers), which is rarely retargeted.
  const beadRows = orderedAssignments.filter((a) => a.role.kind === 'bead')
  const structureRows = orderedAssignments.filter((a) => a.role.kind !== 'bead')
  // show each spool's material only when it's informative (a mixed-material THH
  // catalog); the all-PLA params catalog would just print "PLA" on every row.
  const showMaterial = useMemo(
    () => new Set(catalog.spools.map((s) => s.material)).size > 1,
    [catalog]
  )
  // gh#163 Layer 1 — strip the catalog-wide brand prefix ("Bambu Lab ") so the
  // characters that survive truncation are the distinguishing ones.
  const namePrefix = useMemo(() => sharedNamePrefix(catalog.spools.map((s) => s.name)), [catalog])
  const shortName = (s: FilamentSpool) =>
    namePrefix && s.name.startsWith(namePrefix) && s.name.length > namePrefix.length
      ? s.name.slice(namePrefix.length)
      : s.name
  // tiny uppercase family token beside a spool name — only when the catalog is
  // mixed-material. Support media wear the amber variant: breakaway filament,
  // never a sensible pick for a visible part.
  const materialTag = (material: string) => {
    if (!showMaterial) return null
    const support = isSupportMaterial(material)
    return (
      <span
        data-element="abacus-studio-material-tag"
        title={support ? `${material} — breakaway support filament` : material}
        style={{
          flex: '0 0 auto',
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          lineHeight: 1.6,
          padding: '0 4px',
          borderRadius: 3,
          border: support ? '1px solid rgba(251,191,36,0.55)' : '1px solid rgba(148,163,184,0.4)',
          color: support ? 'rgba(253,230,138,0.95)' : 'rgba(148,163,184,0.95)',
        }}
      >
        {material}
      </span>
    )
  }
  // gh#163 Layer 2 — the picker's swatches, sectioned by co-print group when the
  // catalog knows materials. The plan's anchor group leads undimmed; other
  // temperature families and support media follow, dimmed but fully clickable —
  // an off-anchor pin is allowed and answered by the warning strip, never
  // blocked. Color-only catalogs keep the flat grid (label-less section).
  const pickerSections = useMemo<PickerSection[]>(() => {
    const entries = catalog.spools.map((spool, idx) => ({ spool, idx }))
    const anchor = plan.anchorGroup
    if (!showMaterial || !anchor) return [{ key: 'all', label: null, dim: false, spools: entries }]
    const support = entries.filter(({ spool }) => isSupportMaterial(spool.material))
    const byGroup = new Map<string, typeof entries>()
    for (const entry of entries) {
      if (isSupportMaterial(entry.spool.material)) continue
      const g = coPrintGroup(entry.spool.material)
      const arr = byGroup.get(g)
      if (arr) arr.push(entry)
      else byGroup.set(g, [entry])
    }
    const sections: PickerSection[] = []
    const anchorSpools = byGroup.get(anchor)
    if (anchorSpools) {
      sections.push({
        key: anchor,
        label: `${anchor} · prints with this plate`,
        dim: false,
        spools: anchorSpools,
      })
    }
    for (const [g, groupSpools] of byGroup) {
      if (g === anchor) continue
      sections.push({
        key: g,
        label: `${g} · needs a different plate temperature`,
        dim: true,
        spools: groupSpools,
      })
    }
    if (support.length > 0) {
      sections.push({
        key: 'support',
        label: 'Support · breakaway material',
        dim: true,
        spools: support,
      })
    }
    return sections
  }, [catalog, plan.anchorGroup, showMaterial])
  const [mappingOpen, setMappingOpen] = useState(defaultMappingOpen)
  // which role's picker is expanded (at most one — opening a row collapses the
  // rest). Kept out here rather than per-row so the accordion is single-open by
  // construction, and an inline expand dodges the click-outside/positioning traps
  // of a floating popover over the WebGL canvas.
  const [openRole, setOpenRole] = useState<string | null>(defaultOpenRole)
  const setRoleSpool = (roleKey: string, spoolId: string) =>
    setOverrides((prev) => {
      const next = { ...prev }
      if (spoolId) next[roleKey] = spoolId
      else delete next[roleKey]
      return next
    })
  // gh#163 Layer 3 — deep link from a warning chip to the role's mapping row:
  // open the disclosure, expand that row's picker, and scroll it into view once
  // the panel exists (rAF because the rows may be mounting this same commit).
  const mappingRowRefs = useRef(new Map<string, HTMLDivElement>())
  const revealRole = (roleKey: string) => {
    setMappingOpen(true)
    setOpenRole(roleKey)
  }
  useEffect(() => {
    if (!mappingOpen || !openRole) return
    const raf = requestAnimationFrame(() =>
      mappingRowRefs.current.get(openRole)?.scrollIntoView({ block: 'nearest' })
    )
    return () => cancelAnimationFrame(raf)
  }, [mappingOpen, openRole])

  // One role row: a calm summary line (intended color → the filament it prints on)
  // that expands in place to a filament picker. Shared by both groups so the two
  // never drift. A pinned row earns the panel's only accent (cyan rail + ring).
  const renderMappingRow = (a: RoleAssignment) => {
    const interactive = catalog.spools.length > 1
    const assigned = catalog.spools[a.spoolIndex]
    const preferred = preferredByRole.get(a.role.key)
    const isOpen = interactive && openRole === a.role.key
    const rowStyle: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      width: '100%',
      padding: '5px 6px',
      textAlign: 'left',
      border: 'none',
      borderLeft: `2px solid ${a.overridden ? 'rgba(103,232,249,0.95)' : 'transparent'}`,
      borderRadius: 6,
      background: isOpen ? 'rgba(255,255,255,0.05)' : undefined,
      color: 'rgba(203,213,225,0.9)',
      fontSize: 11,
      cursor: interactive ? 'pointer' : 'default',
    }
    const header = (
      <>
        <span
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {a.role.label}
        </span>
        <span
          title={assigned.hex}
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            flex: '0 0 auto',
            background: assigned.hex,
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: a.overridden
              ? '0 0 0 1px #111827, 0 0 0 2px rgba(103,232,249,0.95)'
              : 'none',
          }}
        />
        <span
          title={showMaterial ? `${assigned.name} · ${assigned.material}` : assigned.name}
          style={{
            flex: '0 1 auto',
            minWidth: 0,
            maxWidth: 96,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 10.5,
            color: 'rgba(148,163,184,0.95)',
          }}
        >
          {shortName(assigned)}
        </span>
        {materialTag(assigned.material)}
        {interactive && (
          <span
            aria-hidden="true"
            className="abx-chevron"
            style={{
              flex: '0 0 auto',
              fontSize: 10,
              color: 'rgba(148,163,184,0.7)',
              transform: isOpen ? 'rotate(90deg)' : 'none',
            }}
          >
            ▸
          </span>
        )}
      </>
    )
    return (
      <div
        key={a.role.key}
        ref={(el) => {
          if (el) mappingRowRefs.current.set(a.role.key, el)
          else mappingRowRefs.current.delete(a.role.key)
        }}
        data-element="abacus-studio-mapping-row"
        data-role={a.role.key}
        style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        {interactive ? (
          <button
            type="button"
            className="abx-map-row"
            data-action="toggle-mapping-row"
            aria-expanded={isOpen}
            onClick={() => setOpenRole((prev) => (prev === a.role.key ? null : a.role.key))}
            style={rowStyle}
          >
            {header}
          </button>
        ) : (
          <div style={rowStyle}>{header}</div>
        )}

        {isOpen && (
          <div
            className="abx-reveal"
            data-element="abacus-studio-role-picker"
            style={{
              // float over the rows below instead of pushing them down — opening a
              // picker must not reflow the panel. Anchored to this (relative) row.
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 2,
              marginTop: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(17,24,39,0.98)',
              border: '1px solid rgba(148,163,184,0.25)',
              boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
            }}
          >
            {/* the designed (intrinsic) color lives here, on-demand, instead of
                doubling every resting row — this is what the ✓ is matching to. */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                aria-hidden="true"
                title={`designed ${a.role.intrinsicHex}`}
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  flex: '0 0 auto',
                  background: a.role.intrinsicHex,
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              />
              <span
                style={{
                  fontSize: 9.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(148,163,184,0.75)',
                }}
              >
                Match {a.role.label}
              </span>
            </span>
            <div
              role="group"
              aria-label={`filament for ${a.role.label}`}
              style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
            >
              {pickerSections.map((sec) => (
                <div
                  key={sec.key}
                  data-element="abacus-studio-picker-group"
                  data-group={sec.key}
                  style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                >
                  {sec.label && (
                    <span
                      style={{
                        fontSize: 8.5,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 700,
                        color: sec.dim ? 'rgba(251,191,36,0.75)' : 'rgba(148,163,184,0.85)',
                      }}
                    >
                      {sec.label}
                    </span>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {sec.spools.map(({ spool: s, idx }) => {
                      const isAssigned = idx === a.spoolIndex
                      const isPreferred = idx === preferred
                      const ring = a.overridden ? 'rgba(103,232,249,0.95)' : 'rgba(226,232,240,0.9)'
                      const dimNote = sec.dim
                        ? sec.key === 'support'
                          ? ' · breakaway support'
                          : ' · different plate temperature'
                        : ''
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className="abx-swatch"
                          data-action="override-role-spool"
                          aria-label={`${a.role.label} uses ${s.name}${showMaterial ? ` ${s.material}` : ''} ${s.hex}${isPreferred ? ' (best match)' : ''}${dimNote}`}
                          aria-pressed={isAssigned}
                          title={`${showMaterial ? `${s.name} · ${s.material} · ${s.hex}` : `${s.name} · ${s.hex}`}${isPreferred ? ' · best match' : ''}${dimNote}`}
                          onClick={() => setRoleSpool(a.role.key, s.id)}
                          style={{
                            position: 'relative',
                            width: 22,
                            height: 22,
                            borderRadius: 5,
                            flex: '0 0 auto',
                            padding: 0,
                            background: s.hex,
                            border: '1px solid rgba(255,255,255,0.25)',
                            cursor: 'pointer',
                            // dimmed ≠ disabled: off-anchor picks stay clickable
                            // (the warning strip answers them); the current
                            // assignment stays legible even in a dim section.
                            opacity: sec.dim && !isAssigned ? 0.45 : 1,
                            boxShadow: isAssigned ? `0 0 0 2px #111827, 0 0 0 4px ${ring}` : 'none',
                          }}
                        >
                          {isPreferred && (
                            <span
                              aria-hidden="true"
                              style={{
                                position: 'absolute',
                                top: -5,
                                right: -5,
                                width: 13,
                                height: 13,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(17,24,39,0.95)',
                                border: '1px solid rgba(226,232,240,0.8)',
                                color: 'rgba(226,232,240,0.95)',
                                fontSize: 8,
                                lineHeight: 1,
                              }}
                            >
                              ✓
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 9.5,
                color: 'rgba(148,163,184,0.7)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 auto',
                  background: 'rgba(17,24,39,0.95)',
                  border: '1px solid rgba(226,232,240,0.8)',
                  color: 'rgba(226,232,240,0.95)',
                  fontSize: 8,
                }}
              >
                ✓
              </span>
              best match — closest color{showMaterial ? ' & compatible material' : ''}
            </span>
            {a.overridden && (
              <button
                type="button"
                data-action="clear-role-override"
                onClick={() => setRoleSpool(a.role.key, '')}
                style={{
                  alignSelf: 'flex-start',
                  padding: '2px 8px',
                  borderRadius: 5,
                  border: '1px solid rgba(148,163,184,0.5)',
                  background: 'transparent',
                  color: 'rgba(226,232,240,0.95)',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                ↺ Back to auto
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      data-element="abacus-studio-print-preview"
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <FilamentReconcileStrip
        plan={plan}
        catalog={catalog}
        onPickRole={revealRole}
        onRevealIntrinsic={onRevealIntrinsic}
      />

      {reductionWarnings.length > 0 && (
        <div
          data-element="abacus-studio-plan-warnings"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(120,53,15,0.30)',
            border: '1px solid rgba(251,191,36,0.45)',
            color: 'rgba(254,243,199,0.96)',
            fontSize: 11,
            lineHeight: 1.45,
          }}
        >
          {reductionWarnings.map((w) => {
            // the roles this warning names, resolved to live assignments;
            // each becomes a chip that deep-links into the mapping panel
            const offenders = CHIP_WARNING_CODES.has(w.code)
              ? (w.roleKeys ?? [])
                  .map((key) => plan.assignments.find((x) => x.role.key === key))
                  .filter((x): x is RoleAssignment => x !== undefined)
              : []
            // fixable ⇔ pinned away from auto-snap's pick (the solver is
            // pin-blind, so an un-pinned role already sits on the
            // preferred spool). "Fix" simply drops those pins — the
            // anchor-restricted auto-snap does the rest.
            const fixable = offenders.filter((x) => {
              const pref = preferredByRole.get(x.role.key)
              return pref !== undefined && pref !== x.spoolIndex
            })
            return (
              <div
                key={w.code}
                data-element="abacus-studio-plan-warning"
                data-code={w.code}
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <div>{w.message}</div>
                {offenders.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 5,
                      alignItems: 'center',
                    }}
                  >
                    {offenders.map((x) => {
                      const spool = catalog.spools[x.spoolIndex]
                      return (
                        <button
                          key={x.role.key}
                          type="button"
                          data-action="reveal-role-mapping"
                          data-role={x.role.key}
                          onClick={() => revealRole(x.role.key)}
                          aria-label={`${x.role.label} prints on ${spool.name}${showMaterial ? ` (${spool.material})` : ''} — show it in the filament mapping`}
                          title="Show in filament mapping"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 8px',
                            borderRadius: 999,
                            border: '1px solid rgba(251,191,36,0.4)',
                            background: 'rgba(0,0,0,0.25)',
                            color: 'rgba(254,243,199,0.96)',
                            fontSize: 10.5,
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 3,
                              flex: '0 0 auto',
                              background: x.role.intrinsicHex,
                              border: '1px solid rgba(255,255,255,0.3)',
                            }}
                          />
                          <span>{x.role.label}</span>
                          <span aria-hidden="true" style={{ opacity: 0.7 }}>
                            →
                          </span>
                          <span
                            aria-hidden="true"
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 3,
                              flex: '0 0 auto',
                              background: spool.hex,
                              border: '1px solid rgba(255,255,255,0.3)',
                            }}
                          />
                          <span
                            style={{
                              maxWidth: 84,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {shortName(spool)}
                          </span>
                          {materialTag(spool.material)}
                        </button>
                      )
                    })}
                    {fixable.length > 0 && (
                      <button
                        type="button"
                        data-action="fix-plan-warning"
                        data-code={w.code}
                        onClick={() =>
                          setOverrides((prev) => {
                            const next = { ...prev }
                            for (const x of fixable) delete next[x.role.key]
                            return next
                          })
                        }
                        style={{
                          padding: '3px 9px',
                          borderRadius: 5,
                          border: '1px solid rgba(251,191,36,0.6)',
                          background: 'rgba(251,191,36,0.14)',
                          color: 'rgba(254,243,199,0.98)',
                          fontSize: 10.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ↺ Fix — back to auto
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* manual override — pin any role to a specific loaded filament.
                  Auto-snap picks by nearest color within the plate's co-print
                  anchor group (gh#163); this is the escape hatch. A pin that
                  leaves the anchor, lands on support media, or splits the
                  frame/marker weld lights the warning strip above — allowed,
                  never blocked. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          type="button"
          data-action="toggle-filament-mapping"
          aria-expanded={mappingOpen}
          onClick={() => setMappingOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 2px',
            border: 'none',
            background: 'transparent',
            color: 'rgba(203,213,225,0.9)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <span>
            Filament mapping
            {activeOverrides > 0 && (
              <span style={{ marginLeft: 6, color: 'rgba(103,232,249,0.95)' }}>
                · {activeOverrides} pinned
              </span>
            )}
          </span>
          <span aria-hidden="true">{mappingOpen ? '▾' : '▸'}</span>
        </button>

        {mappingOpen && (
          <div
            data-element="abacus-studio-filament-mapping"
            style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <style>{MAPPING_CSS}</style>

            {catalog.spools.length === 1 && (
              <div
                style={{
                  fontSize: 10.5,
                  lineHeight: 1.4,
                  color: 'rgba(148,163,184,0.85)',
                  padding: '0 6px 4px',
                }}
              >
                One filament loaded — load more to remap roles.
              </div>
            )}

            {beadRows.length > 0 && (
              <>
                <div
                  data-element="abacus-studio-mapping-group"
                  data-group="beads"
                  style={GROUP_LABEL}
                >
                  Beads
                </div>
                {beadRows.map(renderMappingRow)}
              </>
            )}

            {structureRows.length > 0 && (
              <>
                <div
                  data-element="abacus-studio-mapping-group"
                  data-group="structure"
                  style={{ ...GROUP_LABEL, color: 'rgba(148,163,184,0.7)' }}
                >
                  Structure{' '}
                  <span style={{ fontWeight: 400, color: 'rgba(148,163,184,0.5)' }}>
                    · rarely changed
                  </span>
                </div>
                {structureRows.map(renderMappingRow)}
              </>
            )}

            {activeOverrides > 0 && (
              <button
                type="button"
                data-action="clear-all-overrides"
                onClick={() => setOverrides({})}
                style={{ ...RESET_BTN, alignSelf: 'flex-start', marginTop: 4 }}
              >
                ↺ Reset all to auto
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
