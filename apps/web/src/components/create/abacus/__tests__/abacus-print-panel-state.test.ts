/**
 * abacusPrintPanelState (Gitea #19) — the print panel's state machine, pinned as a
 * pure function so the five no-AMS / external-spool states are testable without
 * mounting the panel. Locks the load-bearing decisions: the branch ORDER
 * (unavailable → loading → degrade → printable), the degrade PRIORITY CHAIN
 * (external-unprintable before empty-roster, because a loaded-but-unidentified spool
 * leaves a row), the `?? not ||` AMS tri-state (a live `false` never falls back to the
 * static capability), and that the monochrome note is scoped to a single EXTERNAL spool.
 */
import type { TicketStyle } from '@eink/print-dialog'
import { describe, expect, it } from 'vitest'
import type { FilamentCatalog, FilamentSpool } from '../abacus-catalog'
import {
  type AbacusPrintPanelStateInput,
  abacusPrintPanelState,
  designSlotIds,
  feetSupportGate,
  supportsEnabled,
} from '../abacus-print-panel-state'

const spool = (over: Partial<FilamentSpool> = {}): FilamentSpool => ({
  id: '0.1',
  name: 'Spool',
  hex: '#112233',
  material: 'PLA',
  ...over,
})

const manual = (spools: FilamentSpool[] = []): FilamentCatalog => ({
  source: 'manual-params',
  spools,
})
const thh = (spools: FilamentSpool[]): FilamentCatalog => ({
  source: 'thh-ams',
  spools,
  fetchedAt: '2026-07-19T00:00:00.000Z',
})

// A neutral, printable-by-default base; each test overrides only what it exercises.
const base: AbacusPrintPanelStateInput = {
  unavailable: null,
  isLoading: false,
  catalog: thh([spool({ id: '0.1' }), spool({ id: '0.2' })]),
  rosterEmpty: false,
  externalUnprintable: false,
  amsPresent: undefined,
  printerMultiMaterial: false,
}
const st = (over: Partial<AbacusPrintPanelStateInput>) =>
  abacusPrintPanelState({ ...base, ...over })

describe('abacusPrintPanelState — branch order', () => {
  it('unavailable wins over everything else', () => {
    expect(st({ unavailable: 'unreachable', isLoading: true, catalog: manual() }).kind).toBe(
      'unavailable'
    )
  })

  it('loading wins over the degrade/printable states (once service is available)', () => {
    expect(st({ isLoading: true, catalog: manual(), rosterEmpty: true }).kind).toBe('loading')
  })
})

describe('abacusPrintPanelState — degrade priority chain (source !== thh-ams)', () => {
  it('E: a loaded-but-unidentified external spool is external-unprintable — BEFORE empty', () => {
    // rosterEmpty is false here (a row exists), yet a spool IS loaded: "nothing
    // loaded" would lie, so external-unprintable must take precedence.
    expect(st({ catalog: manual(), externalUnprintable: true, rosterEmpty: false }).kind).toBe(
      'external-unprintable'
    )
  })

  it('defensive: no external, roster not resolved-empty → roster-unavailable', () => {
    expect(st({ catalog: manual(), externalUnprintable: false, rosterEmpty: false }).kind).toBe(
      'roster-unavailable'
    )
  })

  it('C(AMS): empty roster on an AMS printer → ams-empty (live flag)', () => {
    expect(st({ catalog: manual(), rosterEmpty: true, amsPresent: true }).kind).toBe('ams-empty')
  })

  it('C(no-AMS): empty roster with no AMS → no-ams-empty (live flag)', () => {
    expect(st({ catalog: manual(), rosterEmpty: true, amsPresent: false }).kind).toBe(
      'no-ams-empty'
    )
  })
})

describe('abacusPrintPanelState — AMS tri-state (?? not ||)', () => {
  it('falls back to the static capability when amsPresent is undefined (pre-#382)', () => {
    expect(
      st({
        catalog: manual(),
        rosterEmpty: true,
        amsPresent: undefined,
        printerMultiMaterial: true,
      }).kind
    ).toBe('ams-empty')
    expect(
      st({
        catalog: manual(),
        rosterEmpty: true,
        amsPresent: undefined,
        printerMultiMaterial: false,
      }).kind
    ).toBe('no-ams-empty')
  })

  it('a live amsPresent:false is HONORED — never masked by a static has_ams:true', () => {
    // the whole point of preferring the live signal: `?? not ||`.
    expect(
      st({ catalog: manual(), rosterEmpty: true, amsPresent: false, printerMultiMaterial: true })
        .kind
    ).toBe('no-ams-empty')
  })
})

describe('abacusPrintPanelState — printable + monochrome note (state D)', () => {
  it('a multi-spool thh-ams catalog is printable, no monochrome note', () => {
    expect(st({ catalog: thh([spool({ id: '0.1' }), spool({ id: '0.2' })]) })).toEqual({
      kind: 'printable',
      monochromeExternal: false,
    })
  })

  it('a single EXTERNAL spool is printable WITH the monochrome note (state D)', () => {
    expect(st({ catalog: thh([spool({ id: 'external-0', external: true })]) })).toEqual({
      kind: 'printable',
      monochromeExternal: true,
    })
  })

  it('a single non-external (1-slot AMS) spool is printable WITHOUT the note', () => {
    // the note is scoped to external===true; a 1-slot AMS collapse is out of #19 scope.
    expect(st({ catalog: thh([spool({ id: '0.1', external: false })]) })).toEqual({
      kind: 'printable',
      monochromeExternal: false,
    })
  })

  it('externalUnprintable is IGNORED when the catalog is already thh-ams (mixed roster)', () => {
    // a null-family external alongside a real AMS slot: the AMS print works, the
    // external is silently ignored → printable, not external-unprintable.
    expect(st({ catalog: thh([spool({ id: '0.1' })]), externalUnprintable: true }).kind).toBe(
      'printable'
    )
  })
})

describe('supportsEnabled (Gitea #23)', () => {
  const withProcess = (process: Record<string, string | number | boolean>): TicketStyle =>
    ({ basePreset: 'p', process }) as unknown as TicketStyle

  it('recognizes every truthy encoding of enable_support', () => {
    expect(supportsEnabled(withProcess({ enable_support: true }))).toBe(true)
    expect(supportsEnabled(withProcess({ enable_support: 1 }))).toBe(true)
    expect(supportsEnabled(withProcess({ enable_support: '1' }))).toBe(true)
    expect(supportsEnabled(withProcess({ enable_support: 'true' }))).toBe(true)
  })

  it('treats explicit-off and absent both as off — supports are never defaulted on', () => {
    expect(supportsEnabled(withProcess({ enable_support: false }))).toBe(false)
    expect(supportsEnabled(withProcess({ enable_support: 0 }))).toBe(false)
    expect(supportsEnabled(withProcess({ enable_support: '0' }))).toBe(false)
    expect(supportsEnabled(withProcess({}))).toBe(false)
    expect(supportsEnabled(null)).toBe(false)
  })
})

describe('feetSupportGate (Gitea #23)', () => {
  const on = {
    basePreset: 'p',
    process: { enable_support: '1', support_on_build_plate_only: '1' },
  } as unknown as TicketStyle
  const off = { basePreset: 'p', process: {} } as unknown as TicketStyle

  it('truth table: blocked ⇔ printed feet on a framed render without explicit supports', () => {
    const cases: Array<[string, boolean, TicketStyle | null, boolean]> = [
      // [feet_mode, show_frame, style, blocked]
      ['printed', true, off, true], // the gate's reason to exist
      ['printed', true, null, true], // style still loading — same block
      ['printed', true, on, false], // one-click fix applied
      ['printed', false, off, false], // frameless render: no feet body, no supports needed
      ['adhesive', true, off, false], // stick-on pockets sit ON the bed
      ['none', true, off, false],
    ]
    for (const [feet_mode, show_frame, style, blocked] of cases) {
      expect(feetSupportGate({ feet_mode, show_frame }, style).blocked).toBe(blocked)
    }
  })

  it('asks for both recipe keys, and only the ones still missing', () => {
    const framed = { feet_mode: 'printed', show_frame: true }
    expect(feetSupportGate(framed, off).missing).toEqual([
      'enable_support',
      'support_on_build_plate_only',
    ])
    expect(feetSupportGate(framed, on).missing).toEqual([])
  })

  it('supports on but free to land on the model: advice, not a block', () => {
    // The print succeeds either way — it just comes off the bed with support
    // grown inside the bead channels, which nobody can reach. So the panel
    // nags without barring the submit.
    const style = { basePreset: 'p', process: { enable_support: true } } as unknown as TicketStyle
    const gate = feetSupportGate({ feet_mode: 'printed', show_frame: true }, style)
    expect(gate.blocked).toBe(false)
    expect(gate.missing).toEqual(['support_on_build_plate_only'])
  })

  it('never nags a design that has no printed feet', () => {
    for (const feet_mode of ['adhesive', 'none']) {
      expect(feetSupportGate({ feet_mode, show_frame: true }, off).missing).toEqual([])
    }
    expect(feetSupportGate({ feet_mode: 'printed', show_frame: false }, off).missing).toEqual([])
  })
})

describe('designSlotIds (the support-interface pick can never be a design slot)', () => {
  const spools = ['0.1', '0.2', '0.3', '0.4'].map((id) => spool({ id }))
  const base = { frame: 0, markerWhite: 1, markerBlack: 1, beadRoles: [2, 2] }

  it('collects every role the map assigns, deduped', () => {
    expect([...designSlotIds(base, spools)]).toEqual(['0.1', '0.2', '0.3'])
  })

  it('counts the feet role only when the plan minted one', () => {
    expect(designSlotIds({ ...base, feet: 3 }, spools).has('0.4')).toBe(true)
    expect(designSlotIds(base, spools).has('0.4')).toBe(false)
  })

  it('ignores an index the roster no longer has (a spool unloaded mid-session)', () => {
    expect([...designSlotIds({ ...base, feet: 9 }, spools)]).toEqual(['0.1', '0.2', '0.3'])
  })
})
