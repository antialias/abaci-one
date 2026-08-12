'use client'

// ModularSeamPanel — modular columns (Gitea #30) in the studio's right rail.
//
// WHY THE RIGHT RAIL. Mono-vs-modular is a FABRICATION strategy — whether the
// abacus comes off the plate in one piece or thirteen — not a design property.
// The design reads the same either way, and the panel's downloads have to sit
// beside the other export buttons, which is where plates get to a printer.
//
// THE FLOW IT SELLS: print the seam COUPON first (one small plate, twice),
// tune `joint_fit` until the pair clicks shut flush with no seam gap, then cut
// the module KIT at that fit — the fit rides both filenames so a reprint after
// tuning is attributable. The kit is the modular export; whole-abacus exports
// stay on the mono path (CP8 gates them off in modular mode, because a fused
// monolith with dead sockets is a footgun, not a print).
//
// Verdicts come from `seamFit` — the TS mirror of every scad assert the seam
// geometry can trip — so a bad design is reported HERE with the knob that
// fixes it, instead of aborting inside a render the user already paid for.

import { useState } from 'react'
import { Disclosure } from '@/components/studio/Disclosure'
import { StudioSelect } from '@/components/studio/StudioSelect'
import { DebugCheckbox, DebugSlider } from '@/components/toys/ToyDebugPanel'
import { useAbacusStudio } from './AbacusStudioContext'
import {
  derived,
  isModular,
  type JointType,
  type Params,
  SLIDING_FIT_VALUES,
  seamFit,
} from './abacus-model'
import { buildModuleKit, moduleKitPlan } from './abacus-module-kit'
import { downloadBlob } from './download-blob'

/** Default-off, admin-managed at /admin/feature-flags. The toggle underneath
 *  it moves real geometry (the seam widens every column pitch by one web), so
 *  the feature stays invisible until somebody asks for it — an unset flag
 *  reads as disabled. */
export const MODULAR_COLUMNS_FLAG = 'abacus.modular_columns'

const mm = (v: number) => v.toFixed(1)

const BTN = (enabled: boolean) =>
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

export function ModularSeamPanel() {
  const {
    params,
    set,
    requestExportPass,
    requestExportModuleParts,
    exporterReady,
    filamentMap,
    catalog,
  } = useAbacusStudio()
  const [busy, setBusy] = useState<'coupon' | 'kit' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const on = isModular(params)
  const sliding = params.joint_type === 'sliding_dovetail'
  const jointSlug = sliding ? 'sliding-dovetail' : 'vertical-snap'
  // Both sizes come from the ONE derived chain the geometry uses, evaluated at
  // each mode — a second copy of the arithmetic here is exactly how a readout
  // and the thing it describes drift apart.
  const delta = modularSizeDelta(params)

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

  // What the kit would contain, from the same plan the build uses. Only
  // meaningful in modular mode (the kit build throws on a mono design).
  const plan = on ? moduleKitPlan(params, filamentMap) : null
  const pieces = plan?.reduce((n, e) => n + e.count, 0) ?? 0

  const couponReady = exporterReady && couponFitOk && busy === null
  const kitReady = exporterReady && fit.ok && on && busy === null

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
    <Disclosure
      label="Modular columns"
      dataElement="abacus-modular-seam"
      dataAction="toggle-modular-seam"
    >
      <div
        data-element="modular-seam-body"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <DebugCheckbox
          label="Print as separate column modules"
          checked={on}
          onChange={(v) => set('seam_mode', v ? 'modular' : 'mono')}
        />

        <StudioSelect
          label="Joint mechanism"
          value={params.joint_type}
          options={[
            { value: 'vertical_snap', label: 'Vertical dovetails + snap clip' },
            { value: 'sliding_dovetail', label: 'Front-to-back sliding dovetail' },
          ]}
          onChange={(v) => {
            const joint = v as JointType
            set('joint_type', joint)
            if (
              joint === 'sliding_dovetail' &&
              !SLIDING_FIT_VALUES.some((fitValue) => Math.abs(fitValue - params.joint_fit) < 1e-9)
            ) {
              set('joint_fit', SLIDING_FIT_VALUES[0])
            }
          }}
          dataElement="modular-joint-type"
          dataAction="select-modular-joint-type"
        />

        <div
          data-element="modular-joint-explanation"
          style={{ fontSize: 11, lineHeight: 1.5, color: 'rgba(226,232,240,0.75)' }}
        >
          {sliding
            ? 'Three graduated dovetail keys slide in through the rear entry mouth — loose the whole way, engaging only over the last centimeter. Push firmly until the module stops against the blind front seat; the tapered seat is self-holding. Remove with a firm rearward tug.'
            : 'Vertical dovetails carry the seam while the crossbar clip clicks at full depth. Modules press straight down and any middle module can lift straight out.'}
        </div>

        <div
          data-element="modular-seam-size-delta"
          style={{ fontSize: 11, lineHeight: 1.5, color: 'rgba(226,232,240,0.75)' }}
        >
          {params.cols} columns:{' '}
          <strong style={{ color: on ? 'rgba(148,163,184,0.9)' : 'rgba(243,244,246,1)' }}>
            {mm(delta.mono[0])} × {mm(delta.mono[1])} mm
          </strong>
          {' → '}
          <strong style={{ color: on ? 'rgba(243,244,246,1)' : 'rgba(148,163,184,0.9)' }}>
            {mm(delta.modular[0])} × {mm(delta.modular[1])} mm
          </strong>
          <div style={{ marginTop: 3, color: 'rgba(148,163,184,0.85)' }}>
            Each seam keeps a full wall on both sides — every column carries its own web — so the
            row grows by one web per seam. Every module also carries its own feet, so any subset
            stands.
          </div>
        </div>

        {/* The seam's verdict. Each failing row names the knob that fixes it —
            the same contract feetFit has with the feet notes — because these
            mirror scad asserts: a failure here is an abort there. */}
        {fit.ok ? (
          <div
            data-element="modular-seam-verdict-ok"
            style={{ fontSize: 11, color: 'rgba(134,239,172,0.9)', lineHeight: 1.5 }}
          >
            {sliding
              ? 'Sliding joint fit OK — no flexures; the ~1.9° seat taper is self-holding.'
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
            style={BTN(kitReady)}
          >
            {busy === 'kit' ? 'Rendering module passes…' : '⬇ Module print kit (.zip)'}
          </button>
          <div style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(148,163,184,0.85)' }}>
            {plan
              ? `${pieces} modules across ${plan.length} files — one 3MF per bead-color variant, print counts in the filenames and README.`
              : 'One 3MF per module variant, with print counts and assembly notes in a README.'}
          </div>
        </div>

        {error ? (
          <div
            data-element="modular-seam-export-error"
            style={{ fontSize: 11, color: 'rgba(254,202,202,0.95)', lineHeight: 1.5 }}
          >
            Export failed: {error}
          </div>
        ) : null}

        <div style={{ fontSize: 10, lineHeight: 1.5, color: 'rgba(148,163,184,0.7)' }}>
          Phase 1: end modules carry engraved marker pockets, not printed markers — the camera loop
          needs the sticker sheet until marker plugs land. Frame text prints on the side rails and
          end walls (they ride the two end modules); the top/bottom rails and front/back walls cross
          every seam, so words there print on the one-piece abacus only.
        </div>
      </div>
    </Disclosure>
  )
}

/** Exported for the story/test seam: the panel is pure in `params`, so the
 *  size delta it quotes is derivable without mounting it — one derived()
 *  chain, evaluated at each mode. Returns [frameW, outerD] pairs. */
export const modularSizeDelta = (
  p: Params
): { mono: [number, number]; modular: [number, number] } => {
  const a = derived({ ...p, seam_mode: 'mono' })
  const b = derived({ ...p, seam_mode: 'modular' })
  return { mono: [a.frameW, a.outerD], modular: [b.frameW, b.outerD] }
}
