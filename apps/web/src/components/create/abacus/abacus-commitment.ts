import type { FilamentPlanResponseV1 } from '@eink/print-dialog'
import type { FilamentCatalog } from './abacus-catalog'
import { INFILL_OPTIONS, type InfillLevel, infillOption, resolveInfill } from './abacus-infill'
import {
  bumperLabel,
  type FilamentMap,
  frameW,
  isModular,
  matchBumper,
  outerD,
  type Params,
} from './abacus-model'
import { moduleKitPlan } from './abacus-module-kit'
import { type PrintPlan, roleShifted } from './abacus-plan'
import type { FeetSupportGate } from './abacus-print-panel-state'

export type CommitmentKey =
  | 'pieces'
  | 'filaments'
  | 'supports'
  | 'feet'
  | 'infill'
  | 'jobs'
  | 'time'
export const COMMITMENT_ORDER: readonly CommitmentKey[] = [
  'pieces',
  'filaments',
  'supports',
  'feet',
  'infill',
  'jobs',
  'time',
]
export const COMMITMENT_LABELS: Record<CommitmentKey, string> = {
  pieces: 'pieces',
  filaments: 'filaments',
  supports: 'supports',
  feet: 'feet',
  infill: 'infill',
  jobs: 'jobs',
  time: 'time',
}
export interface CommitmentLine {
  value: string
  note?: string
}
export type CommitmentSummary = Record<CommitmentKey, CommitmentLine>
export interface FilamentPlanFacts {
  loaded: number
  used: number
  shifted: number
}
export type CommitmentPlan = FilamentPlanResponseV1 | PrintPlan

const isMaterialized = (plan: CommitmentPlan): plan is PrintPlan => 'catalogSource' in plan

export function filamentPlanFacts(
  catalog: FilamentCatalog,
  plan: CommitmentPlan | null
): FilamentPlanFacts {
  if (!plan) return { loaded: catalog.spools.length, used: 0, shifted: 0 }
  if (isMaterialized(plan)) {
    return {
      loaded: catalog.spools.length,
      used: new Set(plan.assignments.filter((a) => a.spoolIndex >= 0).map((a) => a.spoolId)).size,
      shifted: plan.assignments.filter(
        (a) => ['frame', 'bead', 'text'].includes(a.role.kind) && roleShifted(a)
      ).length,
    }
  }
  return {
    loaded: catalog.spools.length,
    used: new Set(
      plan.assignments
        .flatMap((a) =>
          a.filament ? [a.filament.slotId ?? (a.filament.external ? 'external' : '')] : []
        )
        .filter(Boolean)
    ).size,
    shifted: plan.assignments.filter(
      (a) => /^(frame|bead-|text-)/.test(a.paletteId) && a.deltaE00 !== null && a.deltaE00 > 10
    ).length,
  }
}

export type CommitmentPrinter =
  | { kind: 'unpaired' }
  | {
      kind: 'paired'
      bedMm: { x: number; y: number } | null
      monochromeExternal: boolean
      supports: { enabled: boolean; interface: string | null }
      feetGate: FeetSupportGate
      twoStage: { on: boolean; feetSpool: string | null }
      kit: 'none' | 'pending' | 'fits' | 'spills'
    }
export interface CommitmentInput {
  params: Params
  filamentMap: FilamentMap
  catalog: FilamentCatalog
  plan: CommitmentPlan | null
  printer: CommitmentPrinter
}

export const TIME_BAND: Record<InfillLevel, string> = {
  light: 'Quick print — light infill is the fastest frame.',
  standard: 'Baseline print time.',
  sturdy: 'Longer print — a sturdy frame adds roughly a quarter.',
  solid: 'Long print — a solid frame roughly doubles the baseline.',
}
void INFILL_OPTIONS

export function commitmentSummary({
  params,
  filamentMap,
  catalog,
  plan,
  printer,
}: CommitmentInput): CommitmentSummary {
  const modular = isModular(params)
  const kitPlan = modular ? moduleKitPlan(params, filamentMap) : []
  const modules = kitPlan.reduce((total, entry) => total + entry.count, 0)
  const facts = filamentPlanFacts(catalog, plan)
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  let pieces = modular
    ? `${plural(modules, 'module')} · ${plural(kitPlan.length, 'file')}`
    : `One piece · ${frameW(params).toFixed(1)} × ${outerD(params).toFixed(1)} mm`
  if (printer.kind === 'paired') {
    if (!modular && printer.bedMm) pieces += ` on a ${printer.bedMm.x} × ${printer.bedMm.y} mm bed`
    if (modular && printer.kit === 'fits') pieces = `${plural(modules, 'module')} on one plate`
    if (modular && printer.kit === 'pending')
      pieces = `${plural(modules, 'module')} · fitting the plate…`
    if (modular && printer.kit === 'spills')
      pieces = `${plural(modules, 'module')} · more than one plate`
  }
  const piecesLine: CommitmentLine = { value: pieces }
  if (printer.kind === 'paired' && modular && printer.kit === 'spills')
    piecesLine.note = 'The plate preview below says which modules spill.'

  let filaments: CommitmentLine
  if (printer.kind === 'unpaired')
    filaments = {
      value: plural(plan ? facts.used : facts.loaded, 'filament'),
      note: 'Load them in your slicer.',
    }
  else if (printer.monochromeExternal)
    filaments = {
      value: `No AMS · one color: ${catalog.spools[0]?.name ?? 'the loaded spool'}`,
      note: 'Your multi-color design collapses to one filament.',
    }
  else
    filaments = {
      value: `${plural(facts.loaded, 'filament')} loaded · ${facts.shifted === 0 ? 'prints true' : `${plural(facts.shifted, 'color')} shift`}`,
    }

  let supports: CommitmentLine
  if (printer.kind === 'unpaired')
    supports = {
      value: 'set in your slicer',
      ...(params.feet_mode === 'printed' && params.show_frame
        ? { note: 'Printed feet stand the abacus off the bed, so the bottom face needs supports.' }
        : {}),
    }
  else if (printer.feetGate.blocked) supports = { value: 'off — needed for printed feet' }
  else if (!printer.supports.enabled) supports = { value: 'off' }
  else if (printer.twoStage.on)
    supports = {
      value: `on · interface in the feet filament${printer.twoStage.feetSpool ? ` (${printer.twoStage.feetSpool})` : ''}, printed in the feet stage`,
      // the floor's plate contact is a sparse comb (two-stage-print.ts), which
      // is why it comes off the plate at all — worth one line here since the
      // paragraph that used to say so is gone
      note: 'Its floor is a sparse comb against the plate, so it peels off instead of bonding.',
    }
  else
    supports = {
      value: printer.supports.interface
        ? `on · interface in ${printer.supports.interface}`
        : 'on · same filament as the model',
      ...(printer.feetGate.missing.includes('support_on_build_plate_only')
        ? { note: 'Allowed to touch the model — see below.' }
        : {}),
    }

  let feet = 'none'
  if (params.show_frame && params.feet_mode === 'printed') feet = 'printed TPU feet · always solid'
  else if (params.show_frame && params.feet_mode === 'adhesive')
    feet = `pockets for ${matchBumper(params) ? bumperLabel(matchBumper(params)!) : 'stick-on bumpers'}`

  const infill = resolveInfill(params)
  let infillLine: CommitmentLine
  if (params.infill_linked)
    infillLine = { value: `${infillOption(infill.frame).label} — frame and beads` }
  else if (params.color_scheme === 'monochrome')
    infillLine = {
      value: `frame ${infillOption(infill.frame).label} · beads follow the frame`,
      note: "One filament means one body, so the beads take the frame's infill.",
    }
  else
    infillLine = {
      value: `frame ${infillOption(infill.frame).label} · beads ${infillOption(infill.beads).label}`,
    }

  const jobs =
    printer.kind === 'unpaired'
      ? 'set in your slicer'
      : printer.twoStage.on
        ? 'two jobs · feet first from the external spool, then the body after a spool swap'
        : 'one job'
  let time = TIME_BAND[infill.frame]
  if (modular) time += ' Many small pieces add travel.'
  if (printer.kind === 'paired' && printer.twoStage.on)
    time += ' Two jobs, with a spool swap between.'
  return {
    pieces: piecesLine,
    filaments,
    supports,
    feet: { value: feet },
    infill: infillLine,
    jobs: { value: jobs },
    time: { value: time },
  }
}
