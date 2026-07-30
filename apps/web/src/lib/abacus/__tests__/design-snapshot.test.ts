/**
 * Design-snapshot guard (Gitea #22): the single parse used on both the POST
 * (refuse junk) and GET (never hydrate garbage) sides, plus the canonical
 * serialization the dedup content-hash is computed over.
 */

import { describe, expect, it } from 'vitest'
import { defaultParams } from '@/components/create/abacus/abacus-model'
import { DEFAULT_PROFILE_ID } from '@/components/create/abacus/abacus-solver'
import {
  ABACUS_DESIGN_SNAPSHOT_VERSION,
  canonicalDesignSnapshot,
  parseDesignSnapshot,
} from '@/lib/abacus/design-snapshot'

const valid = () => ({
  v: ABACUS_DESIGN_SNAPSHOT_VERSION,
  params: { ...defaultParams, cols: 15, top_text: 'Sonia' },
  overrides: { 'bead:earth': 'ams-1-2' },
  profileId: 'fdm-0.4',
})

describe('parseDesignSnapshot', () => {
  it('round-trips a well-formed snapshot', () => {
    const parsed = parseDesignSnapshot(valid())
    expect(parsed).toEqual(valid())
  })

  it('rejects non-objects and wrong versions', () => {
    expect(parseDesignSnapshot(null)).toBeNull()
    expect(parseDesignSnapshot('design')).toBeNull()
    expect(parseDesignSnapshot([])).toBeNull()
    expect(parseDesignSnapshot({})).toBeNull()
    expect(parseDesignSnapshot({ ...valid(), v: 2 })).toBeNull()
    expect(parseDesignSnapshot({ ...valid(), v: '1' })).toBeNull()
  })

  it('rejects an envelope whose params is not an object', () => {
    expect(parseDesignSnapshot({ ...valid(), params: null })).toBeNull()
    expect(parseDesignSnapshot({ ...valid(), params: 'cols=13' })).toBeNull()
    expect(parseDesignSnapshot({ ...valid(), params: [13] })).toBeNull()
  })

  it('drops unknown params keys and defaults missing/mistyped ones', () => {
    const parsed = parseDesignSnapshot({
      v: 1,
      params: { cols: 15, frame_h: 'tall', evil_key: 'x' },
      overrides: {},
      profileId: DEFAULT_PROFILE_ID,
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.params.cols).toBe(15)
    expect(parsed!.params.frame_h).toBe(defaultParams.frame_h) // mistyped → default
    expect(parsed!.params.top_text).toBe(defaultParams.top_text) // missing → default
    expect('evil_key' in parsed!.params).toBe(false)
  })

  it('clamps cols into the studio range', () => {
    const at = (cols: number) =>
      parseDesignSnapshot({ v: 1, params: { cols }, overrides: {}, profileId: '' })!.params.cols
    expect(at(1)).toBe(3)
    expect(at(99)).toBe(21)
    expect(at(13.4)).toBe(13)
  })

  it('keeps only string→string overrides entries', () => {
    const parsed = parseDesignSnapshot({
      v: 1,
      params: { ...defaultParams },
      overrides: { good: 'spool-1', bad: 7, worse: { nested: true } },
      profileId: DEFAULT_PROFILE_ID,
    })
    expect(parsed!.overrides).toEqual({ good: 'spool-1' })
  })

  it('defaults a missing or non-object overrides to {}', () => {
    expect(parseDesignSnapshot({ v: 1, params: {} })!.overrides).toEqual({})
    expect(parseDesignSnapshot({ v: 1, params: {}, overrides: 'x' })!.overrides).toEqual({})
  })

  it('normalizes an unknown or missing profileId to the default profile', () => {
    expect(parseDesignSnapshot({ v: 1, params: {} })!.profileId).toBe(DEFAULT_PROFILE_ID)
    expect(parseDesignSnapshot({ v: 1, params: {}, profileId: 'sla-9000' })!.profileId).toBe(
      DEFAULT_PROFILE_ID
    )
    expect(parseDesignSnapshot({ v: 1, params: {}, profileId: 'fdm-0.4' })!.profileId).toBe(
      'fdm-0.4'
    )
  })
})

describe('canonicalDesignSnapshot', () => {
  it('is key-order independent — the dedup hash input converges', () => {
    const a = parseDesignSnapshot(valid())!
    const shuffled = parseDesignSnapshot({
      profileId: 'fdm-0.4',
      overrides: { 'bead:earth': 'ams-1-2' },
      params: Object.fromEntries(Object.entries(valid().params).reverse()),
      v: 1,
    })!
    expect(canonicalDesignSnapshot(shuffled)).toBe(canonicalDesignSnapshot(a))
  })

  it('differs when any restorable field differs', () => {
    const base = parseDesignSnapshot(valid())!
    const edited = parseDesignSnapshot({ ...valid(), overrides: {} })!
    expect(canonicalDesignSnapshot(edited)).not.toBe(canonicalDesignSnapshot(base))
  })
})

describe('legacy feet params (pre-#23 snapshots)', () => {
  it('drops the retired feet/feet_preset/retention keys and loads printed-feet defaults', () => {
    // Every pre-#23 snapshot carried these exact values (the knobs were
    // UI-unreachable, so they never varied). The keys no longer exist in
    // defaultParams, so the parser must drop them — a surviving
    // `retention: "none"` would reach the scad and fail its literal assert.
    const parsed = parseDesignSnapshot({
      v: 1,
      params: {
        ...defaultParams,
        feet: true,
        feet_preset: 'circle 9',
        retention: 'none',
        feet_mode: undefined,
        feet_retention: undefined,
        feet_proud: undefined,
      },
      overrides: {},
      profileId: DEFAULT_PROFILE_ID,
    })
    expect(parsed).not.toBeNull()
    expect('feet' in parsed!.params).toBe(false)
    expect('retention' in parsed!.params).toBe(false)
    expect('feet_preset' in parsed!.params).toBe(false)
    expect(parsed!.params.feet_mode).toBe('printed')
    expect(parsed!.params.feet_retention).toBe('crossbar')
    expect(parsed!.params.feet_proud).toBe(defaultParams.feet_proud)
  })
})

describe('legacy rail presets (pre-#28 snapshots)', () => {
  // These CANNOT just be dropped the way the feet keys were. The feet knobs had
  // no UI, so every stored design carried the same values; `<rail>_preset` had a
  // control, so its values VARY — and dropping them would silently re-normalize
  // somebody's saved abacus into the default layout.
  const legacy = (params: Record<string, unknown>) =>
    parseDesignSnapshot({
      v: 1,
      params: { ...defaultParams, aid_10: undefined, aid_5: undefined, ...params },
      overrides: {},
      profileId: DEFAULT_PROFILE_ID,
    })!.params

  it('restores a swapped design swapped, not normalized', () => {
    const p = legacy({
      top_preset: 'friends-of-5',
      bottom_preset: 'friends-of-10',
      left_preset: 'custom',
      right_preset: 'custom',
    })
    expect(p.aid_5).toBe('top')
    expect(p.aid_10).toBe('bottom')
    expect('top_preset' in p).toBe(false)
  })

  it('leaves a rail the user deliberately blanked BLANK — off, not auto', () => {
    // 'auto' would helpfully put the aid straight back, which is the one thing
    // this design said it didn't want.
    const p = legacy({
      top_preset: 'custom',
      bottom_preset: 'custom',
      left_preset: 'custom',
      right_preset: 'custom',
    })
    expect(p.aid_10).toBe('off')
    expect(p.aid_5).toBe('off')
  })

  it('restores custom words, and drops the aid that no rail claimed', () => {
    const p = legacy({ top_preset: 'custom', top_text: 'ADA', bottom_preset: 'friends-of-5' })
    expect(p.top_text).toBe('ADA')
    expect(p.aid_5).toBe('bottom')
    expect(p.aid_10).toBe('off')
  })

  it('clears the words on a rail the preset was shadowing', () => {
    // pre-#28 `slotTokens(preset, custom)` IGNORED the text whenever the preset
    // wasn't 'custom', so that text was dead data. Keeping it would hand the rail
    // to words-win and relocate the aid — i.e. render the design differently than
    // it was saved.
    const p = legacy({ top_preset: 'friends-of-10', top_text: 'stale' })
    expect(p.top_text).toBe('')
    expect(p.aid_10).toBe('top')
  })

  it('leaves a modern envelope entirely alone', () => {
    const p = parseDesignSnapshot({
      v: 1,
      params: { ...defaultParams, aid_10: 'left', aid_5: 'off' },
      overrides: {},
      profileId: DEFAULT_PROFILE_ID,
    })!.params
    expect(p.aid_10).toBe('left')
    expect(p.aid_5).toBe('off')
  })

  it('falls back to auto for an aid value that means nothing', () => {
    const p = parseDesignSnapshot({
      v: 1,
      params: { ...defaultParams, aid_10: 'diagonally' },
      overrides: {},
      profileId: DEFAULT_PROFILE_ID,
    })!.params
    expect(p.aid_10).toBe('auto')
  })
})
