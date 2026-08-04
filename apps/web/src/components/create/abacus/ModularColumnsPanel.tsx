'use client'

// ModularColumnsPanel — the AbacusLink prototype's surface in the studio.
//
// SPEC: apps/web/docs/abacus-studio/modular-columns-spec.md
//
// WHY THE RIGHT RAIL. Mono-vs-modular is a FABRICATION strategy — a sub-axis of
// the paper/FDM `FabricationKind` — not a design property. The abacus reads the
// same either way; what changes is whether it comes off the plate in one piece
// or thirteen. It also has to sit beside the download buttons, which is where
// the two plates actually get to a printer.
//
// WHAT THE TOGGLE ACTUALLY DOES, in this revision: it raises two dimension
// floors (a wider web, because the seam halves it; a wider border, because the
// end strips now carry a latch AND a foot) and nothing else. The assembled
// abacus still renders as ONE solid. The topology change waits on analyzeShells,
// which identifies the frame as "the one shell wider than a column pitch" —
// a test every column module fails, taking the viewer's whole recolor pass with
// it. The two plate downloads are what you print in the meantime, and they force
// the modular floors on regardless of the toggle, so a coupon is always cut to
// the pitch a modular abacus would actually have.

import { useState } from 'react'
import { Disclosure } from '@/components/studio/Disclosure'
import { DebugCheckbox, DebugSlider } from '@/components/toys/ToyDebugPanel'
import { useAbacusStudio } from './AbacusStudioContext'
import { linkDerived, linkFit, linkMechanics, linkParamsOf } from './abacus-link'
import { derived, isModular, type Params, type RenderPass } from './abacus-model'

/** Default-off, admin-managed at /admin/feature-flags. The toggle underneath it
 *  moves real geometry, so the prototype stays invisible until somebody asks
 *  for it — an unset flag reads as disabled. */
export const MODULAR_COLUMNS_FLAG = 'abacus.modular_columns'

/** The two plates, and what each one is for. Both emit TWO pieces in print pose,
 *  because in both cases the thing under test is the seam between them. */
const PLATES: ReadonlyArray<{
  pass: RenderPass
  label: string
  file: string
  hint: string
}> = [
  {
    pass: { only: 'link_coupon' },
    label: '⬇ Joint coupon',
    file: 'abacus-link-coupon',
    hint: 'Two half-blocks, one full interface, ~15 min. Does the cam actually cam, hold, and release? Print this first, and print it at three ramp angles.',
  },
  {
    pass: { only: 'link_column' },
    label: '⬇ Column pair',
    file: 'abacus-link-column-pair',
    hint: 'Two real column modules with their captive beads. Does halving the web disturb capture, and do two columns click up flush?',
  },
]

const mm = (v: number) => v.toFixed(1)

export function ModularColumnsPanel() {
  const { params, set, requestExportPass, exporterReady } = useAbacusStudio()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Both sizes come from the ONE derived chain the geometry uses, evaluated at
  // each mode — a second copy of the arithmetic here is exactly how a readout
  // and the thing it describes drift apart.
  const monoSize = derived({ ...params, link_mode: 'mono' })
  const modSize = derived({ ...params, link_mode: 'modular' })
  const on = isModular(params)

  // The joint's own guards, run against THIS design rather than against the
  // coupon defaults — so shrinking the abacus past the joint's size floor is
  // reported here instead of failing inside a render the user already paid for.
  const link = linkParamsOf(params)
  const fit = linkFit(link)
  const mech = linkMechanics(link)
  const geom = linkDerived(link)

  const download = async (plate: (typeof PLATES)[number]) => {
    setError(null)
    setBusy(plate.file)
    try {
      const stl = await requestExportPass(plate.pass)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([stl], { type: 'model/stl' }))
      a.download = `${plate.file}-ramp${params.link_ramp}-x${params.scale_factor}.stl`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      setError(String((err as Error)?.message ?? err))
    } finally {
      setBusy(null)
    }
  }

  const knob = (
    label: string,
    key: 'link_ramp' | 'link_fit' | 'link_relief' | 'link_bump',
    min: number,
    max: number,
    step: number,
    fmt: (v: number) => string
  ) => (
    <DebugSlider
      label={label}
      value={params[key]}
      min={min}
      max={max}
      step={step}
      formatValue={fmt}
      onChange={(v) => set(key, v)}
    />
  )

  return (
    <Disclosure
      label="Modular columns (prototype)"
      dataElement="abacus-modular-columns"
      dataAction="toggle-modular-columns"
    >
      <div
        data-element="modular-columns-body"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <DebugCheckbox
          label="Modular column dimensions"
          checked={on}
          onChange={(v) => set('link_mode', v ? 'modular' : 'mono')}
        />

        <div
          data-element="modular-size-delta"
          style={{ fontSize: 11, lineHeight: 1.5, color: 'rgba(226,232,240,0.75)' }}
        >
          {params.cols} columns:{' '}
          <strong style={{ color: on ? 'rgba(148,163,184,0.9)' : 'rgba(243,244,246,1)' }}>
            {mm(monoSize.frameW)} × {mm(monoSize.outerD)} mm
          </strong>
          {' → '}
          <strong style={{ color: on ? 'rgba(243,244,246,1)' : 'rgba(148,163,184,0.9)' }}>
            {mm(modSize.frameW)} × {mm(modSize.outerD)} mm
          </strong>
          <div style={{ marginTop: 3, color: 'rgba(148,163,184,0.85)' }}>
            The seam splits the wall between channels, so each module keeps half — too thin at
            stock, hence a wider web. And an end strip now carries a latch tongue <em>and</em> a
            foot pocket, hence a wider border.
          </div>
        </div>

        {/* The joint's verdict. `linkFit` names the knob that fixes each problem,
            which is the whole reason it returns structured reasons instead of a
            boolean — same contract feetFit has with the feet notes. */}
        {fit.fits ? (
          <div
            data-element="modular-verdict-ok"
            style={{ fontSize: 11, color: 'rgba(134,239,172,0.9)', lineHeight: 1.5 }}
          >
            Joint holds ≈{mech.clampPerSeam.toFixed(0)} N per seam, camming {geom.takeUp.toFixed(3)}{' '}
            mm shut. {mech.selfLocking ? 'Self-locking.' : ''}
          </div>
        ) : (
          <div
            data-element="modular-verdict-bad"
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
            {fit.problems.map((p) => (
              <div key={p.code}>
                {p.message} <em style={{ opacity: 0.8 }}>({p.knob})</em>
              </div>
            ))}
          </div>
        )}

        {/* The sweep. §9 of the spec prints the ramp at 8/12/16 on one plate:
            shallower cams harder and holds more, steeper swallows more of what
            the printer got wrong. Which end is right is a question about real
            printers, so it ships as a knob rather than a decision. */}
        {knob('cam ramp (°)', 'link_ramp', 4, 16, 1, (v) => `${v}°`)}
        {knob('barb travel (mm)', 'link_bump', 0.6, 1.8, 0.1, mm)}
        {knob('groove fit (mm)', 'link_fit', 0.05, 0.25, 0.01, (v) => v.toFixed(2))}
        {knob('flat relief (mm)', 'link_relief', 0.15, 0.6, 0.05, (v) => v.toFixed(2))}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {PLATES.map((plate) => (
            <div key={plate.file} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <button
                type="button"
                data-action={`download-${plate.file}`}
                disabled={!exporterReady || !fit.fits || busy !== null}
                onClick={() => download(plate)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 7,
                  border: '1px solid rgba(148,163,184,0.4)',
                  background: 'rgba(30,41,59,0.85)',
                  color: 'rgba(243,244,246,1)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: !exporterReady || !fit.fits || busy !== null ? 'default' : 'pointer',
                  opacity: !exporterReady || !fit.fits || busy !== null ? 0.5 : 1,
                }}
              >
                {busy === plate.file ? 'Rendering…' : plate.label}
              </button>
              <div style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(148,163,184,0.85)' }}>
                {plate.hint}
              </div>
            </div>
          ))}
        </div>

        {error ? (
          <div
            data-element="modular-export-error"
            style={{ fontSize: 11, color: 'rgba(254,202,202,0.95)', lineHeight: 1.5 }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ fontSize: 10, lineHeight: 1.5, color: 'rgba(148,163,184,0.7)' }}>
          Unproven geometry — no headless OpenSCAD exists here, so nothing below the arithmetic has
          been checked by a machine. Measure the coupon before trusting it: seam gap at the flanks,
          step across the top faces, insertion and release force.
        </div>
      </div>
    </Disclosure>
  )
}

/** Exported for the story/test seam: the panel is pure in `params`, so the two
 *  things worth asserting about it — the size delta it quotes and whether the
 *  downloads are reachable — are derivable without mounting it. */
export const modularSizeDelta = (
  p: Params
): { mono: [number, number]; modular: [number, number] } => {
  const a = derived({ ...p, link_mode: 'mono' })
  const b = derived({ ...p, link_mode: 'modular' })
  return { mono: [a.frameW, a.outerD], modular: [b.frameW, b.outerD] }
}
