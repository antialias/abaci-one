import type { TicketStyle } from '@eink/print-dialog'
import { describe, expect, it, vi } from 'vitest'
import { defaultParams, type FilamentMap } from '../abacus-model'
import {
  type AbacusPrintSignatureInputs,
  abacusPrintSignature,
  resolveIdempotencyKey,
} from '../print-idempotency'

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
}

describe('abacusPrintSignature', () => {
  it('is stable for identical inputs and independent of property order', () => {
    const reordered: AbacusPrintSignatureInputs = {
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
