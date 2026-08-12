/**
 * The submit path's kit wiring (Gitea #32, items 6–7) — the seams between the
 * packer and the print panel, tested where they're pure.
 *
 * The panel component itself isn't mounted here: its submit needs a live THH
 * roster, a three.js export bundle and a network round-trip. What IS testable
 * without any of that is every decision the wiring makes — which bed the packer
 * is handed, what identity a packed plate has, and whether a kit and a one-piece
 * abacus can be told apart once they're jobs on a service.
 */
import { describe, expect, it } from 'vitest'
import type { ThhBedGeometry } from '@/lib/abacus/print/filament-wire'
import { bedSizeFromThh } from '../abacus-3mf'
import {
  KitPlateFitError,
  type KitPlateLayout,
  type KitPlatePlacement,
  kitPlateSignature,
} from '../abacus-kit-plate'
import { abacusModelFileName, abacusPrintSignature } from '../print-idempotency'

// ---- bedSizeFromThh ---------------------------------------------------------

describe('bedSizeFromThh (THH machine geometry → the packer/emitter plate)', () => {
  it('is undefined without a bed — the caller falls back to the bundled plate', () => {
    expect(bedSizeFromThh(undefined)).toBeUndefined()
  })

  it('carries the reported size through, with no exclusions to reserve', () => {
    expect(bedSizeFromThh({ sizeMm: { x: 256, y: 256, z: 256 } })).toEqual({
      wMm: 256,
      dMm: 256,
      exclude: [],
    })
  })

  it('reduces an exclusion polygon to its bounding rect', () => {
    // A triangle in the back-right corner: everything downstream reserves
    // rectangles, so it must arrive as the rect that CONTAINS the triangle.
    const bed: ThhBedGeometry = {
      sizeMm: { x: 256, y: 256 },
      exclusionsMm: [
        {
          pointsMm: [
            [200, 210],
            [240, 210],
            [220, 250],
          ],
        },
      ],
    }
    expect(bedSizeFromThh(bed)?.exclude).toEqual([{ xMm: 200, yMm: 210, wMm: 40, dMm: 40 }])
  })

  it('over-reserves rather than under-reserves — the rect covers every vertex', () => {
    const bed: ThhBedGeometry = {
      sizeMm: { x: 256, y: 256 },
      exclusionsMm: [
        {
          pointsMm: [
            [10, 90],
            [30, 20],
            [70, 60],
            [25, 95],
          ],
        },
      ],
    }
    const rect = bedSizeFromThh(bed)?.exclude?.[0]
    expect(rect).toBeDefined()
    for (const [x, y] of bed.exclusionsMm?.[0].pointsMm ?? []) {
      expect(x).toBeGreaterThanOrEqual(rect?.xMm ?? Number.NaN)
      expect(x).toBeLessThanOrEqual((rect?.xMm ?? 0) + (rect?.wMm ?? 0))
      expect(y).toBeGreaterThanOrEqual(rect?.yMm ?? Number.NaN)
      expect(y).toBeLessThanOrEqual((rect?.yMm ?? 0) + (rect?.dMm ?? 0))
    }
  })

  it('drops a zero-point zone instead of emitting a degenerate rect', () => {
    // Math.min() of nothing is Infinity — a kept zone here would poison the bed
    // with a keep-out of infinite extent and nothing would ever pack.
    const bed: ThhBedGeometry = {
      sizeMm: { x: 256, y: 256 },
      exclusionsMm: [{ pointsMm: [] }, { pointsMm: [[5, 5]] }],
    }
    expect(bedSizeFromThh(bed)?.exclude).toEqual([{ xMm: 5, yMm: 5, wMm: 0, dMm: 0 }])
  })
})

// ---- kitPlateSignature ------------------------------------------------------

const placement = (id: string, xMm: number, yMm: number, rotated = false): KitPlatePlacement => ({
  id,
  label: id,
  kind: 'mid',
  column: 1,
  file: `${id}.stl`,
  xMm,
  yMm,
  rotated,
  wMm: 15.5,
  hMm: 100.5,
})

const layout = (over: Partial<KitPlateLayout> = {}): KitPlateLayout => ({
  placements: [placement('a', 10, 10), placement('b', 30, 10, true)],
  tower: { xMm: 158, yMm: 16, wMm: 82, dMm: 72, pinXMm: 168, pinYMm: 26 },
  bed: { wMm: 256, dMm: 256 },
  ...over,
})

describe('kitPlateSignature (identity of a packed arrangement)', () => {
  it('is stable for the same plate', () => {
    expect(kitPlateSignature(layout())).toBe(kitPlateSignature(layout()))
  })

  it('does not depend on the order the placements come back in', () => {
    // The packer is free to emit in any order; the same physical plate is the
    // same plate, and a spurious rotation here would cost a duplicate job.
    const forward = layout()
    const reversed = layout({ placements: [...forward.placements].reverse() })
    expect(kitPlateSignature(reversed)).toBe(kitPlateSignature(forward))
  })

  it('changes when a module moves', () => {
    const moved = layout({ placements: [placement('a', 10, 10), placement('b', 31, 10, true)] })
    expect(kitPlateSignature(moved)).not.toBe(kitPlateSignature(layout()))
  })

  it('changes when a module is turned', () => {
    const turned = layout({
      placements: [placement('a', 10, 10, true), placement('b', 30, 10, true)],
    })
    expect(kitPlateSignature(turned)).not.toBe(kitPlateSignature(layout()))
  })

  it('changes when the tower moves', () => {
    const moved = layout({
      tower: { xMm: 20, yMm: 16, wMm: 82, dMm: 72, pinXMm: 30, pinYMm: 26 },
    })
    expect(kitPlateSignature(moved)).not.toBe(kitPlateSignature(layout()))
  })

  it('changes on a different bed', () => {
    expect(kitPlateSignature(layout({ bed: { wMm: 220, dMm: 220 } }))).not.toBe(
      kitPlateSignature(layout())
    )
  })

  it('ignores sub-micron float wobble — packing arithmetic is not a new plate', () => {
    const wobbled = layout({
      placements: [placement('a', 10 + 1e-9, 10), placement('b', 30, 10 - 1e-9, true)],
    })
    expect(kitPlateSignature(wobbled)).toBe(kitPlateSignature(layout()))
  })

  it('still separates plates a micron apart', () => {
    const nudged = layout({
      placements: [placement('a', 10.001, 10), placement('b', 30, 10, true)],
    })
    expect(kitPlateSignature(nudged)).not.toBe(kitPlateSignature(layout()))
  })
})

// ---- the idempotency signature ---------------------------------------------

const sigInputs = {
  params: { cols: 13, scale_factor: 1 } as never,
  filamentMap: { frame: 0 } as never,
  slotLabels: ['PLA Black'],
  style: { process: {} } as never,
  startPolicy: 'auto' as const,
  supportInterfaceSlotId: null,
}

describe('abacusPrintSignature carries the packed layout', () => {
  it('rotates the key when the packer arranges the same design differently', () => {
    // The point of the field: nothing else in the signature moved. A packer
    // change with a reused key makes THH replay the OLD arrangement and report
    // success, silently discarding the plate we just built.
    const before = abacusPrintSignature({ ...sigInputs, kitLayout: kitPlateSignature(layout()) })
    const after = abacusPrintSignature({
      ...sigInputs,
      kitLayout: kitPlateSignature(
        layout({ placements: [placement('a', 10, 10), placement('b', 30, 40, true)] })
      ),
    })
    expect(before).not.toBe(after)
  })

  it('holds the key for an identical repack — the retry idempotency exists for', () => {
    expect(abacusPrintSignature({ ...sigInputs, kitLayout: kitPlateSignature(layout()) })).toBe(
      abacusPrintSignature({ ...sigInputs, kitLayout: kitPlateSignature(layout()) })
    )
  })

  it('tells a kit apart from the one-piece abacus it was cut from', () => {
    expect(abacusPrintSignature({ ...sigInputs, kitLayout: kitPlateSignature(layout()) })).not.toBe(
      abacusPrintSignature(sigInputs)
    )
  })
})

describe('abacusModelFileName', () => {
  it('names a kit plate distinctly from the one-piece abacus', () => {
    const sig = 'some-signature'
    expect(abacusModelFileName(13, sig, 'kit')).not.toBe(abacusModelFileName(13, sig))
    expect(abacusModelFileName(13, sig, 'kit')).toMatch(/^abacus-kit-13col-h[0-9a-f]+\.3mf$/)
  })

  it('defaults to the one-piece name, so the mono path is untouched', () => {
    expect(abacusModelFileName(13, 'x', 'abacus')).toBe(abacusModelFileName(13, 'x'))
  })
})

// ---- the refusal ------------------------------------------------------------

describe('KitPlateFitError splits what happened from what to do', () => {
  it('keeps `message` as the whole story for logs and bare readers', () => {
    const err = new KitPlateFitError('overflow', ['mid 3 of 11'], 'It did not fit.', 'Try fewer.')
    expect(err.message).toBe('It did not fit. Try fewer.')
    expect(err.headline).toBe('It did not fit.')
    expect(err.remediation).toBe('Try fewer.')
    expect(err).toBeInstanceOf(Error)
  })

  it('always leaves somewhere to go — a refusal without a next step is a dead end', () => {
    const err = new KitPlateFitError('too-big', ['mid'], 'Too big.', 'Scale it down.')
    expect(err.remediation.length).toBeGreaterThan(0)
  })
})
