// Abacus Studio — the build-plate preview (Gitea #32).
//
// Frame Studio's Print track has shown its packed bed as an inline SVG for a
// while (`PrintTrack.tsx`): a viewBox in MILLIMETRES, so the drawing is the bed
// at 1:1 and no scale factor is ever computed; parts as their packed footprint
// rects; the purge tower as a dashed reserve. This is that, for a kit.
//
// TWO DELIBERATE DIVERGENCES FROM EINK.
//
//  1. It DRAWS THE KEEP-OUT. eink's packer honours `bed.exclude` but its preview
//     never draws it, so parts just mysteriously avoid a corner. For us that
//     corner is the whole story: the X1C's 18 × 28 mm filament-cutter zone is
//     what made the first live kit submit die at the slicer with exit 192, and
//     `clearOfKeepOuts` now slides the entire layout — modules and tower
//     together — to clear it. A preview that hid the thing we slide against
//     would hide the interesting part.
//
//  2. It is READ-ONLY. eink's is editable because a frame job spans several
//     plates and the user owns MEMBERSHIP (which plate a part is on) while the
//     packer owns positions. Phase A ships one plate or an honest refusal, so
//     there is no membership to edit and nothing here to drag. When Phase B
//     (#33) adds plates, eink's tap-tap-plus-drag model is the one to copy.
//
// Colour follows eink's rule and carries NO identity: every module is the same
// fill whatever its kind, because a legend keyed on hue is a legend some readers
// can't use. Which module a rectangle is lives in its label and its <title>.
//
// Presentational and hook-free of data — the layout arrives as a prop, so every
// state (fits, refuses, still rendering) is reproducible in Storybook without a
// paired printer or a WASM export.

import { useId } from 'react'
import type { KitPlateLayout, KitPlatePlacement } from './abacus-kit-plate'

export interface KitPlatePreviewProps {
  /** The packed plate. Null while it's being computed, or when it was refused. */
  layout: KitPlateLayout | null
  /** Why there is no plate, straight off `KitPlateFitError`. Rendered instead of
   *  the bed: a refusal is not an empty bed, and drawing one as the other is how
   *  a user ends up waiting for a print that was never going to happen. */
  refusal?: { headline: string; remediation: string; modules: readonly string[] } | null
  /** The layout is being (re)computed — the export it needs takes a moment. */
  pending?: boolean
  /** Printer name for the caption. Falls back to the bed's size. */
  printerName?: string
  /** How many filaments this plate resolves to, for the caption. */
  filaments?: number
}

const BED_FILL = 'rgba(15,23,42,0.72)'
const BED_STROKE = 'rgba(148,163,184,0.45)'
const MODULE_FILL = 'rgba(56,189,248,0.30)'
const MODULE_STROKE = 'rgba(56,189,248,0.85)'
const MODULE_TEXT = 'rgba(224,242,254,0.95)'
const TOWER_STROKE = 'rgba(148,163,184,0.9)'
const KEEPOUT_STROKE = 'rgba(248,113,113,0.85)'

/**
 * Font size for a label inside a `w × h` mm rect, or 0 to draw no label.
 *
 * eink's formula (`Math.min(11, h * 0.55, (w * 1.5) / label.length)`, hidden
 * under 5) with one addition: a kit's modules are tall narrow strips — 15.5 mm
 * wide by 100 mm deep is typical — so measuring the text against the rect's
 * WIDTH would hide every label on the plate. The long side is whichever it is,
 * and the caller turns the text to match.
 */
export function labelFit(wMm: number, hMm: number, label: string): number {
  const along = Math.max(wMm, hMm)
  const across = Math.min(wMm, hMm)
  const size = Math.min(11, across * 0.55, (along * 1.5) / Math.max(label.length, 1))
  return size >= 5 ? size : 0
}

/** One packed module. */
function ModuleRect({ at, dMm }: { at: KitPlatePlacement; dMm: number }) {
  // 3MF +Y runs to the BACK of the bed; SVG y grows downward. Every rect drawn
  // here flips through the bed's depth, so the picture matches what the operator
  // sees standing in front of the printer.
  const y = dMm - at.yMm - at.hMm
  const size = labelFit(at.wMm, at.hMm, at.label)
  const upright = at.wMm >= at.hMm
  const cx = at.xMm + at.wMm / 2
  const cy = y + at.hMm / 2
  return (
    <g data-element="kit-plate-module" data-module-kind={at.kind} data-rotated={at.rotated}>
      <title>{`${at.label} — ${at.wMm.toFixed(1)} × ${at.hMm.toFixed(1)} mm${
        at.rotated ? ', turned 90°' : ''
      }`}</title>
      <rect
        x={at.xMm}
        y={y}
        width={at.wMm}
        height={at.hMm}
        rx={1.5}
        fill={MODULE_FILL}
        stroke={MODULE_STROKE}
        strokeWidth={0.6}
      />
      {size > 0 && (
        <text
          x={cx}
          y={cy}
          fontSize={size}
          fill={MODULE_TEXT}
          textAnchor="middle"
          dominantBaseline="central"
          transform={upright ? undefined : `rotate(-90 ${cx} ${cy})`}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {at.label}
        </text>
      )}
    </g>
  )
}

export function KitPlatePreview({
  layout,
  refusal = null,
  pending = false,
  printerName,
  filaments,
}: KitPlatePreviewProps) {
  const hatchId = useId()

  if (refusal) {
    return (
      <div
        data-component="kit-plate-preview"
        data-state="refused"
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: 'rgba(127,29,29,0.32)',
          border: '1px solid rgba(248,113,113,0.5)',
          color: 'rgba(254,226,226,0.96)',
          lineHeight: 1.45,
          fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 600 }}>{refusal.headline}</div>
        <div style={{ color: 'rgba(254,226,226,0.82)', marginTop: 3 }}>{refusal.remediation}</div>
        {refusal.modules.length > 0 && (
          <div style={{ color: 'rgba(254,226,226,0.7)', marginTop: 4, fontSize: 12 }}>
            {refusal.modules.join(', ')}
          </div>
        )}
      </div>
    )
  }

  if (!layout) {
    return (
      <div
        data-component="kit-plate-preview"
        data-state={pending ? 'pending' : 'idle'}
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          border: `1px dashed ${BED_STROKE}`,
          color: 'rgba(203,213,225,0.72)',
          fontSize: 12,
        }}
      >
        {pending ? 'Laying the kit out on the bed…' : 'No plate to show yet.'}
      </div>
    )
  }

  const { bed, tower, placements } = layout
  const towerY = bed.dMm - tower.yMm - tower.dMm
  const caption = [
    printerName ?? `${Math.round(bed.wMm)} × ${Math.round(bed.dMm)} mm bed`,
    `${placements.length} module${placements.length === 1 ? '' : 's'}`,
    filaments ? `${filaments} filament${filaments === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div data-component="kit-plate-preview" data-state="packed">
      <svg
        viewBox={`0 0 ${bed.wMm} ${bed.dMm}`}
        role="img"
        aria-label={`Build plate layout: ${caption}`}
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8 }}
      >
        <defs>
          {/* Diagonal hatch for the printer's keep-out. Pattern units are the
              same millimetres as everything else, so the hatch reads at the same
              density whatever size the SVG is displayed at. */}
          <pattern
            id={hatchId}
            width={4}
            height={4}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={4} stroke={KEEPOUT_STROKE} strokeWidth={1} />
          </pattern>
        </defs>

        <rect
          x={0}
          y={0}
          width={bed.wMm}
          height={bed.dMm}
          rx={3}
          fill={BED_FILL}
          stroke={BED_STROKE}
          strokeWidth={0.8}
        />

        {(bed.exclude ?? []).map((zone) => (
          <g
            key={`keepout-${zone.xMm}-${zone.yMm}-${zone.wMm}-${zone.dMm}`}
            data-element="kit-plate-keepout"
          >
            <title>
              {`Printer keep-out — ${Math.round(zone.wMm)} × ${Math.round(
                zone.dMm
              )} mm. Nothing may overlap it, and the slicer refuses the whole plate if anything does.`}
            </title>
            <rect
              x={zone.xMm}
              y={bed.dMm - zone.yMm - zone.dMm}
              width={zone.wMm}
              height={zone.dMm}
              fill={`url(#${hatchId})`}
              stroke={KEEPOUT_STROKE}
              strokeWidth={0.6}
            />
          </g>
        ))}

        <g data-element="kit-plate-tower">
          <title>
            {`Purge tower — ${Math.round(tower.wMm)} × ${Math.round(
              tower.dMm
            )} mm reserved before packing, so the modules lay out around it instead of under it.`}
          </title>
          <rect
            x={tower.xMm}
            y={towerY}
            width={tower.wMm}
            height={tower.dMm}
            rx={1.5}
            fill="none"
            stroke={TOWER_STROKE}
            strokeWidth={0.7}
            strokeDasharray="3 2.5"
          />
          {labelFit(tower.wMm, tower.dMm, 'purge') > 0 && (
            <text
              x={tower.xMm + tower.wMm / 2}
              y={towerY + tower.dMm / 2}
              fontSize={labelFit(tower.wMm, tower.dMm, 'purge')}
              fill={TOWER_STROKE}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              purge
            </text>
          )}
        </g>

        {placements.map((at) => (
          <ModuleRect key={at.id} at={at} dMm={bed.dMm} />
        ))}
      </svg>
      <div
        data-element="kit-plate-caption"
        style={{ marginTop: 6, fontSize: 12, color: 'rgba(203,213,225,0.72)' }}
      >
        {caption}
      </div>
    </div>
  )
}
