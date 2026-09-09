import type { FilamentPlanResponseV1 } from '@eink/print-dialog'
import { describe, expect, it } from 'vitest'
import type { FilamentCatalog } from '../abacus-catalog'
import {
  type CommitmentPrinter,
  commitmentSummary,
  filamentPlanFacts,
  TIME_BAND,
} from '../abacus-commitment'
import { INFILL_OPTIONS } from '../abacus-infill'
import { defaultParams, type FilamentMap, type Params } from '../abacus-model'
import { type PrintPlan, type RoleAssignment, roleShifted } from '../abacus-plan'

const catalog: FilamentCatalog = {
  source: 'thh-ams',
  fetchedAt: 'now',
  spools: [
    { id: 'a', name: 'Black', hex: '#000000', material: 'PLA' },
    { id: 'b', name: 'Red', hex: '#ff0000', material: 'PLA' },
  ],
}
const fm: FilamentMap = {
  slots: ['#000', '#f00'],
  frame: 0,
  markerWhite: 0,
  markerBlack: 0,
  beadRoles: [1, 1, 1, 1, 1],
  markerContrast: 21,
  feet: 0,
}
const plan: FilamentPlanResponseV1 = {
  contractVersion: 'filament-plan/v1',
  plannerVersion: 'x',
  printerId: 'p',
  rosterFingerprint: 'r',
  status: 'satisfied',
  warnings: [],
  assignments: [
    {
      paletteId: 'frame',
      status: 'matched',
      filament: {
        slotId: 'a',
        external: false,
        family: 'PLA',
        supportKind: null,
        colorHex: '#000',
        brand: null,
        product: null,
        profileKey: null,
        remainingPct: null,
      },
      deltaE00: 0,
      reasons: [],
      relaxations: [],
    },
    {
      paletteId: 'bead-0',
      status: 'matched',
      filament: {
        slotId: 'b',
        external: false,
        family: 'PLA',
        supportKind: null,
        colorHex: '#f00',
        brand: null,
        product: null,
        profileKey: null,
        remainingPct: null,
      },
      deltaE00: 20,
      reasons: [],
      relaxations: [],
    },
  ],
}
const wirePlan = (...distances: number[]): FilamentPlanResponseV1 => ({
  ...plan,
  assignments: distances.map((deltaE00, index) => ({
    ...plan.assignments[index % plan.assignments.length],
    paletteId: index === 0 ? 'frame' : `bead-${index}`,
    deltaE00,
  })),
})

const materializedAssignments: RoleAssignment[] = [
  {
    role: { kind: 'frame', key: 'frame', label: 'Frame', intrinsicHex: '#000000' },
    spoolId: 'a',
    spoolIndex: 0,
    distance: 20,
    overridden: false,
  },
  {
    role: { kind: 'bead', key: 'bead-0', label: 'Beads', intrinsicHex: '#ff0000' },
    spoolId: 'b',
    spoolIndex: 1,
    distance: 0,
    overridden: false,
  },
  {
    role: { kind: 'text', key: 'text-0', label: 'Inlay text', intrinsicHex: '#ff0000' },
    spoolId: 'b',
    spoolIndex: 1,
    distance: 30,
    overridden: false,
  },
  {
    role: {
      kind: 'markerBlack',
      key: 'marker-black',
      label: 'Black marker',
      intrinsicHex: '#000000',
    },
    spoolId: 'a',
    spoolIndex: 0,
    distance: 40,
    overridden: false,
  },
]
const materializedPlan: PrintPlan = {
  schemaVersion: 1,
  catalogSource: 'thh-ams',
  assignments: materializedAssignments,
  markerContrast: 21,
  warnings: [],
  planStatus: 'satisfied',
  ok: true,
}

const paired = (
  over: Partial<Extract<CommitmentPrinter, { kind: 'paired' }>> = {}
): CommitmentPrinter => ({
  kind: 'paired',
  bedMm: { x: 256, y: 256 },
  monochromeExternal: false,
  supports: { enabled: true, interface: 'Support PLA' },
  feetGate: { missing: [], blocked: false },
  twoStage: { on: false, feetSpool: null },
  kit: 'none',
  ...over,
})
const summary = (
  p: Partial<Params> = {},
  printer: CommitmentPrinter = { kind: 'unpaired' },
  servicePlan: FilamentPlanResponseV1 | null = plan
) =>
  commitmentSummary({
    params: { ...defaultParams, ...p },
    filamentMap: fm,
    catalog,
    plan: servicePlan,
    printer,
  })

describe('commitmentSummary', () => {
  it('describes mono footprints with and without a bed', () => {
    expect(summary().pieces.value).toMatch(/^One piece · \d+\.\d × \d+\.\d mm$/)
    expect(summary({}, paired()).pieces.value).toMatch(/on a 256 × 256 mm bed$/)
  })
  it('describes the modular kit-none fallback with file count', () => {
    expect(summary({ seam_mode: 'modular' }, paired({ kit: 'none' })).pieces).toEqual({
      value: '13 modules · 3 files',
    })
  })
  it('describes a modular kit that fits one plate', () => {
    expect(summary({ seam_mode: 'modular' }, paired({ kit: 'fits' })).pieces).toEqual({
      value: '13 modules on one plate',
    })
  })
  it('describes a modular kit while plate fitting is pending', () => {
    expect(summary({ seam_mode: 'modular' }, paired({ kit: 'pending' })).pieces).toEqual({
      value: '13 modules · fitting the plate…',
    })
  })
  it('describes a modular kit that spills with its preview note', () => {
    expect(summary({ seam_mode: 'modular' }, paired({ kit: 'spills' })).pieces).toEqual({
      value: '13 modules · more than one plate',
      note: 'The plate preview below says which modules spill.',
    })
  })
  it('describes paired filaments that print true', () => {
    expect(summary({}, paired(), wirePlan(0, 10)).filaments).toEqual({
      value: '2 filaments loaded · prints true',
    })
  })
  it('describes two paired color shifts', () => {
    expect(summary({}, paired(), wirePlan(20, 30)).filaments).toEqual({
      value: '2 filaments loaded · 2 colors shift',
    })
  })
  it('describes a paired external monochrome spool', () => {
    expect(summary({}, paired({ monochromeExternal: true })).filaments).toEqual({
      value: 'No AMS · one color: Black',
      note: 'Your multi-color design collapses to one filament.',
    })
  })
  it('describes unpaired slicer filaments', () => {
    expect(summary().filaments).toEqual({ value: '2 filaments', note: 'Load them in your slicer.' })
  })
  it('describes unpaired supports with the printed-feet note', () => {
    expect(summary().supports).toEqual({
      value: 'set in your slicer',
      note: 'Printed feet stand the abacus off the bed, so the bottom face needs supports.',
    })
  })
  it('describes unpaired supports without the printed-feet note', () => {
    expect(summary({ feet_mode: 'none' }).supports).toEqual({ value: 'set in your slicer' })
  })
  it('describes blocked and disabled paired supports', () => {
    expect(
      summary({}, paired({ feetGate: { missing: ['enable_support'], blocked: true } })).supports
    ).toEqual({ value: 'off — needed for printed feet' })
    expect(summary({}, paired({ supports: { enabled: false, interface: null } })).supports).toEqual(
      { value: 'off' }
    )
  })
  it('describes a named support interface', () => {
    expect(
      summary({}, paired({ supports: { enabled: true, interface: 'Support PLA' } })).supports
    ).toEqual({ value: 'on · interface in Support PLA' })
  })
  it("describes supports using the model's own filament", () => {
    expect(summary({}, paired({ supports: { enabled: true, interface: null } })).supports).toEqual({
      value: 'on · same filament as the model',
    })
  })
  it('adds the advisory note when supports may touch the model', () => {
    expect(
      summary(
        {},
        paired({
          supports: { enabled: true, interface: 'Support PLA' },
          feetGate: { missing: ['support_on_build_plate_only'], blocked: false },
        })
      ).supports
    ).toEqual({
      value: 'on · interface in Support PLA',
      note: 'Allowed to touch the model — see below.',
    })
  })
  it('describes the two-stage support interface', () => {
    expect(summary({}, paired({ twoStage: { on: true, feetSpool: 'TPU' } })).supports).toEqual({
      value: 'on · interface in the feet filament (TPU), printed in the feet stage',
      note: 'Its floor is a sparse comb against the plate, so it peels off instead of bonding.',
    })
    // the feet-only variant (Gitea #45): PLA supports in Stage B, the interface pick standing
    const feetOnly = paired({ twoStage: { on: true, feetSpool: 'TPU', feetOnly: true } })
    expect(summary({}, feetOnly).supports.value).toBe(
      'on · PLA from the frame spool, printed in the body stage around the standing feet, interface in Support PLA'
    )
    expect(summary({}, feetOnly).jobs.value).toMatch(/^two jobs · only the feet/)
  })
  it('describes feet variants', () => {
    expect(summary().feet.value).toBe('printed TPU feet · always solid')
    expect(summary({ feet_mode: 'adhesive' }).feet.value).toMatch(/^pockets for /)
    expect(summary({ feet_mode: 'adhesive', feet_w: Math.PI }).feet.value).toBe(
      'pockets for stick-on bumpers'
    )
    expect(summary({ show_frame: false }).feet.value).toBe('none')
  })
  it('describes linked and separate infill', () => {
    expect(summary().infill.value).toBe('Standard — frame and beads')
    expect(
      summary({
        infill_linked: false,
        color_scheme: 'heaven-earth',
        infill_frame: 'light',
        infill_beads: 'solid',
      }).infill.value
    ).toBe('frame Light · beads Solid')
    expect(summary({ infill_linked: false, color_scheme: 'monochrome' }).infill.note).toMatch(
      /One filament/
    )
  })
  it('describes slicer, one-job, and two-job paths', () => {
    expect(summary().jobs.value).toBe('set in your slicer')
    expect(summary({}, paired()).jobs.value).toBe('one job')
    expect(summary({}, paired({ twoStage: { on: true, feetSpool: 'TPU' } })).jobs.value).toMatch(
      /^two jobs/
    )
  })
  it('uses the exact qualitative band for every infill level', () => {
    expect(Object.keys(TIME_BAND).sort()).toEqual(INFILL_OPTIONS.map((option) => option.id).sort())
    expect(summary({ infill_frame: 'light' }).time.value).toBe(
      'Quick print — light infill is the fastest frame.'
    )
    expect(summary({ infill_frame: 'standard' }).time.value).toBe('Baseline print time.')
    expect(summary({ infill_frame: 'sturdy' }).time.value).toBe(
      'Longer print — a sturdy frame adds roughly a quarter.'
    )
    expect(summary({ infill_frame: 'solid' }).time.value).toBe(
      'Long print — a solid frame roughly doubles the baseline.'
    )
  })
  it('never emits a numeric duration and appends modifiers in order', () => {
    for (const level of INFILL_OPTIONS.map((option) => option.id))
      expect(summary({ infill_frame: level }).time.value).not.toMatch(/\d+\s*(min|h\b|hour)/i)
    expect(summary({ seam_mode: 'modular' }).time.value).toBe(
      'Baseline print time. Many small pieces add travel.'
    )
    expect(
      summary({ seam_mode: 'modular' }, paired({ twoStage: { on: true, feetSpool: 'TPU' } })).time
        .value
    ).toBe(
      'Baseline print time. Many small pieces add travel. Two jobs, with a spool swap between.'
    )
  })
})
describe('filamentPlanFacts', () => {
  it('counts loaded, used, and shifted spools', () =>
    expect(filamentPlanFacts(catalog, plan)).toEqual({ loaded: 2, used: 2, shifted: 1 }))
  it('matches the former footer expression for a materialized plan', () => {
    const expectedShifted = materializedPlan.assignments.filter(
      (assignment) =>
        (assignment.role.kind === 'frame' ||
          assignment.role.kind === 'bead' ||
          assignment.role.kind === 'text') &&
        roleShifted(assignment)
    ).length
    expect(filamentPlanFacts(catalog, materializedPlan)).toEqual({
      loaded: 2,
      used: 2,
      shifted: expectedShifted,
    })
    expect(expectedShifted).toBe(2)
  })
  it('returns no assignments for a null plan', () =>
    expect(filamentPlanFacts(catalog, null)).toEqual({ loaded: 2, used: 0, shifted: 0 }))
})
