import { describe, expect, it } from 'vitest'
import { defaultParams, type Params } from '../abacus-model'
import {
  DEFAULT_PROFILE,
  INLAY_DEPTH_MM,
  MIN_THROW_MM,
  PRINTER_PROFILES,
  profileById,
  solve,
} from '../abacus-solver'

const at = (S: number): Params => ({ ...defaultParams, scale_factor: S })
const fdm04 = profileById('fdm-0.4')
const fdm06 = profileById('fdm-0.6')
const fdm02 = profileById('fdm-0.2')

describe('the default profile reproduces today behavior', () => {
  it('passes at the shipped defaults', () => {
    const r = solve(defaultParams, DEFAULT_PROFILE)
    expect(r.ok).toBe(true)
    expect(r.reasons).toEqual([])
    expect(r.profileId).toBe('fdm-0.4')
  })

  it('stays printable across the studio size range (no new refusals)', () => {
    // The size slider spans roughly [0.5, 2]; nothing inside it should refuse
    // under the default profile — the model already renders there today.
    for (const S of [0.5, 0.75, 1.0, 1.5, 2.0]) {
      expect(solve(at(S), DEFAULT_PROFILE).ok).toBe(true)
    }
  })

  it('is pinned to the baked .scad floors (sync guard vs abacus.scad)', () => {
    // If someone edits abacus.scad's asserts, this must be updated in lockstep —
    // the .scad stays a standalone-render backstop pinned to this profile.
    expect(DEFAULT_PROFILE.minWallMm).toBe(1.2) // assert(web * S >= 1.2)
    expect(DEFAULT_PROFILE.minFeatureMm).toBe(2.0) // assert(bar * S >= 2)
    expect(DEFAULT_PROFILE.minInlayDepthMm).toBe(0.6) // inlay_d = 0.6
    expect(DEFAULT_PROFILE.minClearanceMm).toBe(0.2) // clearance floor comment
    expect(INLAY_DEPTH_MM).toBe(0.6)
    expect(MIN_THROW_MM).toBe(2)
  })
})

describe('profile × scale matrix', () => {
  const cases: { profile: typeof fdm04; S: number; ok: boolean; firstDim?: string }[] = [
    { profile: fdm04, S: 0.5, ok: true }, // web·S = 1.25 ≥ 1.2, just clears
    { profile: fdm04, S: 0.4, ok: false, firstDim: 'wall' }, // web·S = 1.0 < 1.2
    { profile: fdm02, S: 0.3, ok: true }, // Fine unlocks it: web·S = 0.75 ≥ 0.6
    { profile: fdm02, S: 0.2, ok: false, firstDim: 'wall' }, // web·S = 0.5 < 0.6
  ]

  for (const c of cases) {
    it(`${c.profile.id} @ S=${c.S} → ${c.ok ? 'ok' : `refuse(${c.firstDim})`}`, () => {
      const r = solve(at(c.S), c.profile)
      expect(r.ok).toBe(c.ok)
      if (!c.ok) expect(r.reasons[0]?.dim).toBe(c.firstDim)
    })
  }

  it('a Fine profile prints smaller than the default before a wall collapses', () => {
    // wall floor binds at S ≥ minWall/web: 1.2/2.5 = 0.48 (default) vs 0.6/2.5 =
    // 0.24 (Fine). So there is a size the default refuses but Fine allows.
    expect(solve(at(0.3), DEFAULT_PROFILE).ok).toBe(false)
    expect(solve(at(0.3), fdm02).ok).toBe(true)
  })

  it('a Wide profile refuses the default fit gap AND inlay depth at S=1', () => {
    const r = solve(defaultParams, fdm06)
    expect(r.ok).toBe(false)
    const dims = r.reasons.map((x) => x.dim).sort()
    expect(dims).toContain('clearance') // 0.25 < 0.30
    expect(dims).toContain('inlay') // 0.60 < 0.90 (markers on by default)
  })
})

describe('refusal reasons carry actionable payloads', () => {
  it('a proportional floor suggests a scale that actually clears it', () => {
    const r = solve(at(0.4), DEFAULT_PROFILE)
    const wall = r.reasons.find((x) => x.dim === 'wall')
    expect(wall).toBeDefined()
    expect(wall?.measuredMm).toBeCloseTo(1.0, 10)
    expect(wall?.floorMm).toBe(1.2)
    expect(wall?.suggestedScale).toBeCloseTo(0.48, 10)
    // and applying that scale really does clear the design
    expect(solve(at(wall?.suggestedScale as number), DEFAULT_PROFILE).ok).toBe(true)
  })

  it('the locked fit-gap floor refuses with NO scale suggestion', () => {
    // scaling can't fix an absolute dimension — the fix is to raise the gap.
    const r = solve({ ...defaultParams, clearance: 0.1 }, DEFAULT_PROFILE)
    expect(r.ok).toBe(false)
    const clr = r.reasons.find((x) => x.dim === 'clearance')
    expect(clr).toBeDefined()
    expect(clr?.suggestedScale).toBeUndefined()
    expect(clr?.floorMm).toBe(0.2)
  })

  it('the inlay floor only applies when markers or text are present', () => {
    const bare: Params = {
      ...defaultParams,
      show_markers: false,
      top_preset: 'custom',
      top_text: '',
      bottom_preset: 'custom',
      bottom_text: '',
    }
    // Wide needs 0.9 mm inlays, but with nothing inlaid there is nothing to fail.
    const r = solve(bare, fdm06)
    expect(r.reasons.some((x) => x.dim === 'inlay')).toBe(false)
    // markers back on → the inlay-depth refusal reappears
    expect(solve({ ...bare, show_markers: true }, fdm06).reasons.some((x) => x.dim === 'inlay')).toBe(
      true,
    )
  })

  it('every reason names its measured value and floor', () => {
    for (const r of solve(defaultParams, fdm06).reasons) {
      expect(typeof r.measuredMm).toBe('number')
      expect(typeof r.floorMm).toBe('number')
      expect(r.message.length).toBeGreaterThan(0)
      expect(r.fix.length).toBeGreaterThan(0)
    }
  })
})

describe('allow contact, refuse only below-floor', () => {
  it('accepts the shipped defaults where the ArUco tile touches the channel wall', () => {
    // The default layout is contact-tight (tile edge lands ON the channel wall);
    // the solver checks floors, never overlap, so contact is fine.
    expect(solve(defaultParams, DEFAULT_PROFILE).ok).toBe(true)
    // ...and there is no contact/overlap dim in the vocabulary at all.
    const dims = solve(at(0.3), DEFAULT_PROFILE).reasons.map((r) => r.dim)
    expect(dims).not.toContain('contact')
    expect(dims).not.toContain('overlap')
  })
})

describe('profile lookup + purity', () => {
  it('resolves ids and falls back to the default for unknown/undefined', () => {
    expect(profileById('fdm-0.2').id).toBe('fdm-0.2')
    expect(profileById('nope').id).toBe('fdm-0.4')
    expect(profileById(undefined).id).toBe('fdm-0.4')
    expect(PRINTER_PROFILES.map((p) => p.id)).toEqual(['fdm-0.4', 'fdm-0.6', 'fdm-0.2'])
  })

  it('does not mutate its inputs and is deterministic', () => {
    const p = Object.freeze({ ...defaultParams, scale_factor: 0.3 }) as Params
    expect(() => solve(p, DEFAULT_PROFILE)).not.toThrow()
    const a = solve(p, DEFAULT_PROFILE)
    const b = solve(p, DEFAULT_PROFILE)
    expect(a).toEqual(b)
  })
})

describe('severity: inlay warns, the rest block', () => {
  it('an inlay-only refusal is a non-blocking warning (ok stays true)', () => {
    // Wide with the fit gap raised past its 0.30 floor leaves inlay as the sole
    // reason — a warning, so the design is still exportable. Without this, Wide
    // (0.90 mm inlay floor vs the fixed 0.60 mm depth) would block every marked
    // design.
    const r = solve({ ...defaultParams, clearance: 0.35 }, fdm06)
    expect(r.ok).toBe(true)
    expect(r.reasons).toHaveLength(1)
    expect(r.reasons[0]?.dim).toBe('inlay')
    expect(r.reasons[0]?.severity).toBe('warning')
  })

  it('a hard floor is an error that blocks (ok false)', () => {
    const r = solve(at(0.4), DEFAULT_PROFILE) // web·S = 1.0 < 1.2
    expect(r.ok).toBe(false)
    expect(r.reasons.find((x) => x.dim === 'wall')?.severity).toBe('error')
  })

  it('classifies every reason: inlay is the only warning', () => {
    for (const r of solve(defaultParams, fdm06).reasons) {
      expect(r.severity).toBe(r.dim === 'inlay' ? 'warning' : 'error')
    }
  })
})
