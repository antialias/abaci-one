'use client'

// Modular columns (Gitea #30), split across the studio's three questions.
//
// THE MODEL. The studio asks three questions, in order, and every control
// belongs to exactly one of them:
//   1. WHAT IS IT — the design rail. True of the abacus whatever the output.
//   2. HOW IS IT MADE — the print rail. FDM-only, and invisible in the object.
//   3. WHAT AM I COMMITTING TO — the bottom of the print rail: the files and
//      the one submit. One primary action, never two.
// Mono-vs-modular is question 1 and lives in the design rail (ConstructionControl):
// it is a geometry Param — it widens the footprint by a web per seam and closes
// four engraving slots — so it changes what the thing IS, not merely how it is
// produced. What modular costs a PRINTER is question 2 (ModularFitPanel: the
// verdict, the fit knob, the coupon), and the kit itself is question 3
// (ModuleKitExport, in the Files section beside the 3MF).
//
// THE FLOW IT SELLS: print the seam COUPON first (one small plate, twice),
// tune `joint_fit` until the pair clicks shut flush with no seam gap, then cut
// the module KIT at that fit — the fit rides both filenames so a reprint after
// tuning is attributable. The kit IS the modular export; the whole-abacus 3MF
// isn't offered in modular mode at all, because a fused monolith with dead
// sockets is a footgun, not a print.
//
// Verdicts come from `seamFit` — the TS mirror of every scad assert the seam
// geometry can trip — so a bad design is reported HERE with the knob that
// fixes it, instead of aborting inside a render the user already paid for.
//
// NOT FLAG-GATED. The construction choice is a per-design choice the user makes,
// not a rollout stage. It spent a short while behind `abacus.modular_columns`,
// which hid the feature from everyone including the person who asked for it;
// that flag is gone (migration 0144 drops the row and its overrides).

import { type CSSProperties, useState } from 'react'
import { DebugSlider } from '@/components/toys/ToyDebugPanel'
import { useAbacusStudio } from './AbacusStudioContext'
import { derived, isModular, type Params, SLIDING_FIT_VALUES, seamFit } from './abacus-model'
import { buildModuleKit, moduleKitPlan } from './abacus-module-kit'
import { downloadBlob } from './download-blob'

/** The rail's secondary button: every download that is NOT the single primary
 *  action of the moment wears this. */
export const BTN = (enabled: boolean) =>
  ({
    padding: '8px 10px',
    borderRadius: 7,
    border: '1px solid rgba(148,163,184,0.4)',
    background: 'rgba(30,41,59,0.85)',
    color: 'rgba(243,244,246,1)',
    fontSize: 12,
    fontWeight: 600,
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.5,
  }) as const

const CYAN_GRADIENT = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'

/** The one cyan-gradient button in the rail. Exactly one control may wear it at
 *  a time: with a paired print service that is the PrintPanel's submit, without
 *  one it is the main file download. Two cyan buttons is two primaries, which is
 *  the bug this shape exists to prevent. */
export const PRIMARY_BTN = (enabled: boolean): CSSProperties => ({
  padding: '11px 12px',
  borderRadius: 8,
  border: 'none',
  background: enabled ? CYAN_GRADIENT : 'rgba(75,85,99,0.55)',
  color: enabled ? '#fff' : 'rgba(209,213,219,0.7)',
  fontSize: 13,
  fontWeight: 700,
  cursor: enabled ? 'pointer' : 'not-allowed',
  boxShadow: enabled ? '0 4px 14px rgba(6,182,212,0.35)' : 'none',
})

/** One render at a time. The coupon and the kit now sit in different sections of
 *  the rail, so the interlock they always had rides as a prop from their common
 *  owner; each component keeps its own state when mounted alone (tests, stories). */
export type SeamBusy = 'coupon' | 'kit' | null
export interface SeamBusyProps {
  busy?: SeamBusy
  onBusy?: (b: SeamBusy) => void
}

const useBusy = ({ busy, onBusy }: SeamBusyProps): [SeamBusy, (b: SeamBusy) => void] => {
  const [own, setOwn] = useState<SeamBusy>(null)
  return [busy !== undefined ? busy : own, onBusy ?? setOwn]
}

/**
 * ModularFitPanel — question 2 for a modular design: what this joint asks of
 * the printer. The verdict, the one tuning knob, and the coupon that tunes it.
 * Rendered in the print rail's "Print options" section, only in modular mode.
 */
export function ModularFitPanel(props: SeamBusyProps = {}) {
  const { params, set, requestExportPass, exporterReady } = useAbacusStudio()
  const [busy, setBusy] = useBusy(props)
  const [error, setError] = useState<string | null>(null)

  const sliding = params.joint_type === 'sliding_dovetail'
  const jointSlug = sliding ? 'sliding-dovetail' : 'vertical-snap'

  // The seam's own guards, run against THIS design — every row mirrors a scad
  // assert, so a failing row means the coupon/module renders would ABORT.
  const fit = seamFit(params)
  const failing = fit.verdicts.filter((v) => !v.ok)
  // Coupon passes contain no feet. The sliding coupon also carries all three
  // calibrated compensations regardless of the currently selected kit fit.
  const couponFitOk = fit.verdicts
    .filter(
      (v) =>
        !['module_feet', 'feet_bumper', 'feet_socket', 'feet_crossbar'].includes(v.code) &&
        !(sliding && v.code === 'sliding_fit')
    )
    .every((v) => v.ok)

  const couponReady = exporterReady && couponFitOk && busy === null

  const downloadCoupon = async () => {
    setError(null)
    setBusy('coupon')
    try {
      // The live-params single-pass escape hatch: one coupon plate, printed
      // twice, IS the snap pair — the thing under test is the seam between
      // the two copies.
      const stl = await requestExportPass({ only: 'seam_coupon' })
      downloadBlob(
        new Blob([stl], { type: 'model/stl' }),
        `abacus-seam-coupon-${jointSlug}-fit${params.joint_fit}-x${params.scale_factor}.stl`
      )
    } catch (err) {
      setError(String((err as Error)?.message ?? err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      data-element="modular-fit-panel"
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <span style={{ fontSize: 11, fontWeight: 500 }}>Module joint fit</span>

      {/* The seam's verdict. Each failing row names the knob that fixes it —
          the same contract feetFit has with the feet notes — because these
          mirror scad asserts: a failure here is an abort there. */}
      {fit.ok ? (
        <div
          data-element="modular-seam-verdict-ok"
          style={{ fontSize: 11, color: 'rgba(134,239,172,0.9)', lineHeight: 1.5 }}
        >
          {sliding
            ? `Sliding joint fit OK — detent strain ${fit.strainPct.toFixed(2)}% (wood-PLA gate 1.0%); the ~1.9° seat taper is self-holding.`
            : `Vertical snap joint fit OK — snap-clip strain ${fit.strainPct.toFixed(2)}% (wood-PLA gate 1.0%).`}
        </div>
      ) : (
        <div
          data-element="modular-seam-verdict-bad"
          style={{
            fontSize: 11,
            lineHeight: 1.5,
            color: 'rgba(254,226,226,0.95)',
            background: 'rgba(127,29,29,0.35)',
            border: '1px solid rgba(248,113,113,0.5)',
            borderRadius: 6,
            padding: '7px 9px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          {failing.map((v) => (
            <div key={v.code}>
              {v.message} <em style={{ opacity: 0.8 }}>({v.knob})</em>
            </div>
          ))}
        </div>
      )}

      <div data-element="modular-joint-fit-control">
        <DebugSlider
          label={sliding ? 'dovetail compensation (mm)' : 'joint fit (mm)'}
          value={params.joint_fit}
          min={sliding ? SLIDING_FIT_VALUES[0] : -0.1}
          max={sliding ? SLIDING_FIT_VALUES[SLIDING_FIT_VALUES.length - 1] : 0.3}
          step={sliding ? 0.01 : 0.01}
          formatValue={(v) => `${v.toFixed(2)} mm`}
          onChange={(v) => set('joint_fit', v)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <button
          type="button"
          data-action="download-seam-coupon"
          disabled={!couponReady}
          onClick={downloadCoupon}
          title={
            couponFitOk
              ? exporterReady
                ? 'Download the seam-fit test coupon'
                : 'Preparing the 3D exporter…'
              : 'Fix the coupon geometry problems above'
          }
          style={BTN(couponReady)}
        >
          {busy === 'coupon' ? 'Rendering…' : '⬇ Seam coupon (STL)'}
        </button>
        <div
          data-element="modular-seam-coupon-instructions"
          style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(148,163,184,0.85)' }}
        >
          {sliding
            ? 'One bounded plate contains 0.10, 0.11, and 0.12 mm samples. Slide pairs together from the rear mouth: reject any that bind before the front stop or will not release with a firm tug; choose the loosest sample with no seated play, then regenerate the kit at that value.'
            : 'One small plate — print it twice; the pair is the vertical snap test. Tune joint fit until the copies click shut flush with no seam wiggle, then generate the kit at that fit.'}
        </div>
      </div>

      {error ? (
        <div
          data-element="modular-seam-coupon-error"
          style={{ fontSize: 11, color: 'rgba(254,202,202,0.95)', lineHeight: 1.5 }}
        >
          Export failed: {error}
        </div>
      ) : null}
    </div>
  )
}

/**
 * ModuleKitExport — question 3 for a modular design: the deliverable. Lives in
 * the print rail's "Files" section beside (in mono mode, instead of) the
 * whole-abacus 3MF, because a kit zip and a 3MF are the same kind of act.
 */
export function ModuleKitExport({
  primary = false,
  ...busyProps
}: SeamBusyProps & { primary?: boolean }) {
  const { params, requestExportModuleParts, exporterReady, filamentMap, catalog } =
    useAbacusStudio()
  const [busy, setBusy] = useBusy(busyProps)
  const [error, setError] = useState<string | null>(null)

  const on = isModular(params)
  const fit = seamFit(params)

  // What the kit would contain, from the same plan the build uses. Only
  // meaningful in modular mode (the kit build throws on a mono design).
  const plan = on ? moduleKitPlan(params, filamentMap) : null
  const pieces = plan?.reduce((n, e) => n + e.count, 0) ?? 0

  const kitReady = exporterReady && fit.ok && on && busy === null

  const downloadKit = async () => {
    setError(null)
    setBusy('kit')
    try {
      // Snapshot-once bundle: all six module passes render from ONE params
      // value inside the viewer, and the kit builds from that exact snapshot.
      const parts = await requestExportModuleParts()
      const kit = buildModuleKit({
        parts,
        filamentMap,
        slotLabels: catalog.spools.map((s) => s.name),
      })
      downloadBlob(new Blob([kit.bytes as BlobPart], { type: 'application/zip' }), kit.filename)
    } catch (err) {
      setError(String((err as Error)?.message ?? err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      data-element="module-kit-export"
      style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
    >
      <button
        type="button"
        data-action="download-module-kit"
        disabled={!kitReady}
        onClick={downloadKit}
        title={
          on
            ? fit.ok
              ? exporterReady
                ? 'Download one multi-material 3MF per module'
                : 'Preparing the 3D exporter…'
              : 'Fix the seam-fit problems above'
            : 'Switch to modular columns first'
        }
        style={primary ? PRIMARY_BTN(kitReady) : BTN(kitReady)}
      >
        {busy === 'kit' ? 'Rendering module passes…' : '⬇ Module print kit (.zip)'}
      </button>
      <div style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(148,163,184,0.85)' }}>
        {plan
          ? `${pieces} modules across ${plan.length} files — one 3MF per bead-color variant, print counts in the filenames and README.`
          : 'One 3MF per module variant, with print counts and assembly notes in a README.'}
      </div>

      {error ? (
        <div
          data-element="modular-seam-export-error"
          style={{ fontSize: 11, color: 'rgba(254,202,202,0.95)', lineHeight: 1.5 }}
        >
          Export failed: {error}
        </div>
      ) : null}
    </div>
  )
}

/** Exported for the story/test seam: the size delta is pure in `params`, so it
 *  is derivable without mounting anything — one derived() chain, evaluated at
 *  each mode. Returns [frameW, outerD] pairs. Read by ConstructionControl, which
 *  quotes it beside the construction choice it explains. */
export const modularSizeDelta = (
  p: Params
): { mono: [number, number]; modular: [number, number] } => {
  const a = derived({ ...p, seam_mode: 'mono' })
  const b = derived({ ...p, seam_mode: 'modular' })
  return { mono: [a.frameW, a.outerD], modular: [b.frameW, b.outerD] }
}
