import type { TicketStyle } from '@eink/print-dialog'
import { describe, expect, it, vi } from 'vitest'
import { defaultParams, type FilamentMap } from '../abacus-model'
import {
  type AbacusPrintSignatureInputs,
  abacusModelFileName,
  abacusPrintSignature,
  resolveIdempotencyKey,
} from '../print-idempotency'

/**
 * A faithful mirror of THH's `ui/lib/archive/model-key.ts:normalizeModelKey` —
 * the function that turns an uploaded filename into the model identity its
 * ghost/orbit viewer caches against. Copied deliberately: these tests assert a
 * property of THEIR reduction, so the reduction has to be present to test it.
 * Keep in sync if THH's rules change.
 */
const MODEL_EXT_RE = /\.(?:gcode\.3mf|gcode\.gz|3mf|gcode|stl|obj)$/i
const PLATE_RE = /[_-]plate[_-]?\d+$/i
const COPY_RE = /(?:[ _-]?\(?copy\)?|[ _-]\(?\d+\)?)$/i
function normalizeModelKey(raw: string): string | null {
  let key = raw.replace(/^.*\//, '').replace(MODEL_EXT_RE, '')
  key = key.replace(PLATE_RE, '')
  key = key.replace(COPY_RE, '')
  key = key
    .replace(/[\s_]+/g, ' ')
    .trim()
    .toLowerCase()
  return key || null
}

const filamentMap: FilamentMap = {
  slots: ['PLA Black', 'PLA White'],
  frame: 0,
  markerWhite: 1,
  markerBlack: 0,
  beadRoles: [0, 1, 0, 1],
  markerContrast: 21,
}
const style = { preset: 'standard' } as unknown as TicketStyle

const base: AbacusPrintSignatureInputs = {
  params: defaultParams,
  filamentMap,
  slotLabels: ['PLA Black', 'PLA White'],
  style,
  startPolicy: 'hold',
  supportInterfaceSlotId: null,
}

describe('abacusPrintSignature', () => {
  it('is stable for identical inputs and independent of property order', () => {
    const reordered: AbacusPrintSignatureInputs = {
      supportInterfaceSlotId: null,
      startPolicy: 'hold',
      style,
      slotLabels: ['PLA Black', 'PLA White'],
      filamentMap: {
        beadRoles: [0, 1, 0, 1],
        markerContrast: 21,
        markerBlack: 0,
        markerWhite: 1,
        frame: 0,
        slots: ['PLA Black', 'PLA White'],
      },
      params: { ...defaultParams },
    }
    expect(abacusPrintSignature(reordered)).toBe(abacusPrintSignature(base))
  })

  it('changes when a geometry param changes', () => {
    const edited = { ...base, params: { ...defaultParams, cols: defaultParams.cols + 1 } }
    expect(abacusPrintSignature(edited)).not.toBe(abacusPrintSignature(base))
  })

  it('changes when the filament map changes', () => {
    const edited = { ...base, filamentMap: { ...filamentMap, markerWhite: 0 } }
    expect(abacusPrintSignature(edited)).not.toBe(abacusPrintSignature(base))
  })

  it('changes when a print setting (style) changes', () => {
    const edited = { ...base, style: { preset: 'fine' } as unknown as TicketStyle }
    expect(abacusPrintSignature(edited)).not.toBe(abacusPrintSignature(base))
  })

  it('changes when the start policy changes', () => {
    expect(abacusPrintSignature({ ...base, startPolicy: 'auto' })).not.toBe(
      abacusPrintSignature(base)
    )
  })

  it('changes when a spool is renamed', () => {
    const edited = { ...base, slotLabels: ['PLA Black', 'PLA Blue'] }
    expect(abacusPrintSignature(edited)).not.toBe(abacusPrintSignature(base))
  })

  it('changes when the support-interface pick changes (THH#367)', () => {
    // null → a slot, and slot → different slot: both change the physical print
    // (which spool lays the interface layers), so both must rotate the key.
    const picked = { ...base, supportInterfaceSlotId: '0.3' }
    expect(abacusPrintSignature(picked)).not.toBe(abacusPrintSignature(base))
    const repicked = { ...base, supportInterfaceSlotId: '0.4' }
    expect(abacusPrintSignature(repicked)).not.toBe(abacusPrintSignature(picked))
  })

  it('array order is significant (bead-role assignment is not a set)', () => {
    const swapped = { ...base, filamentMap: { ...filamentMap, beadRoles: [1, 0, 0, 1] } }
    expect(abacusPrintSignature(swapped)).not.toBe(abacusPrintSignature(base))
  })
})

describe('resolveIdempotencyKey', () => {
  it('mints a key when there is none yet', () => {
    const mint = vi.fn(() => 'k1')
    const token = resolveIdempotencyKey(null, 'sig-a', mint)
    expect(token).toEqual({ sig: 'sig-a', key: 'k1' })
    expect(mint).toHaveBeenCalledTimes(1)
  })

  it('reuses the key for an identical resubmit (same signature) without minting', () => {
    const first = resolveIdempotencyKey(null, 'sig-a', () => 'k1')
    const mint = vi.fn(() => 'k2')
    const second = resolveIdempotencyKey(first, 'sig-a', mint)
    expect(second).toBe(first) // same object, same key
    expect(mint).not.toHaveBeenCalled()
  })

  it('rotates the key when the signature changes (an edit)', () => {
    const held = resolveIdempotencyKey(null, 'sig-a', () => 'k1')
    const mint = vi.fn(() => 'k2')
    const rotated = resolveIdempotencyKey(held, 'sig-b', mint)
    expect(rotated).toEqual({ sig: 'sig-b', key: 'k2' })
    expect(mint).toHaveBeenCalledTimes(1)
  })

  it('the panel loop: edit after a lost response rotates the key (no stale replay)', () => {
    // Submit 1: a fresh design. THH commits but the 202 is lost, so the panel's
    // onSuccess never fires — the token stays in the ref.
    let mints = 0
    const mint = () => `key-${++mints}`
    const held = resolveIdempotencyKey(null, abacusPrintSignature(base), mint)

    // The user edits a setting and resubmits. The signature changed, so the key
    // MUST rotate — otherwise THH would replay the old (unedited) job at 202.
    const editedInputs = { ...base, params: { ...defaultParams, cols: 20 } }
    const afterEdit = resolveIdempotencyKey(held, abacusPrintSignature(editedInputs), mint)
    expect(afterEdit.key).not.toBe(held.key)

    // Whereas a resubmit of the SAME edited design keeps the rotated key, so a
    // genuine retry-after-timeout replays the one job instead of double-printing.
    const retry = resolveIdempotencyKey(afterEdit, abacusPrintSignature(editedInputs), mint)
    expect(retry.key).toBe(afterEdit.key)
  })

  it('a success (ref cleared to null) mints fresh even for an identical design', () => {
    const sig = abacusPrintSignature(base)
    const first = resolveIdempotencyKey(null, sig, () => 'k1')
    // onSuccess sets idemRef.current = null; the next identical submit is a new job.
    const afterSuccess = resolveIdempotencyKey(null, sig, () => 'k2')
    expect(afterSuccess.key).not.toBe(first.key)
  })
})

describe('abacusModelFileName — content identity survives THH normalization', () => {
  const nameFor = (i: AbacusPrintSignatureInputs) =>
    abacusModelFileName(i.params.cols, abacusPrintSignature(i))

  it('gives an identical design an identical name', () => {
    expect(nameFor(base)).toBe(nameFor({ ...base, params: { ...defaultParams } }))
  })

  it('distinguishes designs that share a column count', () => {
    // The exact collision that made THH show a stale mesh: same `cols`, different
    // everything else. The OLD name (`abacus-13col.3mf`) was byte-identical here.
    const a = { ...base, params: { ...defaultParams, frame_color: '#111111' } }
    const b = { ...base, params: { ...defaultParams, frame_color: '#c9a26e' } }
    expect(a.params.cols).toBe(b.params.cols)
    expect(nameFor(a)).not.toBe(nameFor(b))
    expect(normalizeModelKey(nameFor(a))).not.toBe(normalizeModelKey(nameFor(b)))
  })

  it('a filament remap alone rotates the name', () => {
    const remapped = { ...base, filamentMap: { ...filamentMap, frame: 1 } }
    expect(nameFor(remapped)).not.toBe(nameFor(base))
  })

  it('survives normalizeModelKey — the hash is never eaten as a copy counter', () => {
    // The `h` prefix exists for this. An all-digit suffix would be stripped by
    // THH's COPY_RE, restoring the collision. Sweep enough designs that a digits-
    // only hash would have shown up (~2.3% each) if the prefix were missing.
    const keys = new Set<string>()
    for (let n = 0; n < 300; n++) {
      const name = nameFor({ ...base, params: { ...defaultParams, scale_factor: 1 + n / 1000 } })
      const key = normalizeModelKey(name)
      expect(key).toBeTruthy()
      // The discriminator must still be attached after normalization.
      expect(key).not.toBe(`abacus-${defaultParams.cols}col`)
      expect(key).toMatch(/-h[0-9a-f]{8}$/)
      keys.add(key as string)
    }
    // 300 distinct designs → 300 distinct model identities (no fnv collision here).
    expect(keys.size).toBe(300)
  })

  it('survives a Bambu plate suffix on the card file', () => {
    const stem = nameFor(base).replace(/\.3mf$/, '')
    expect(normalizeModelKey(`${stem}_plate_1.gcode.3mf`)).toBe(normalizeModelKey(nameFor(base)))
  })
})
