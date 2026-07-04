import { describe, it, expect } from 'vitest'
import { getCategorySkillIds, getFullSkillId } from '@/constants/skillCategories'
import {
  ALL_STAGED_SKILL_IDS,
  computeFrontierRank,
  deriveLinearReadyFromEvidence,
  deriveLinearReadySkills,
  groupLinearReadyByCategory,
  stageRank,
  type SkillEvidence,
} from '../linear-readiness'

// Real catalog ids so the tests exercise the true stage model, not a stand-in.
const CAT = {
  basic: getCategorySkillIds('basic'),
  five: getCategorySkillIds('fiveComplements'),
  ten: getCategorySkillIds('tenComplements'),
  fiveSub: getCategorySkillIds('fiveComplementsSub'),
  tenSub: getCategorySkillIds('tenComplementsSub'),
}
const CASCADING_CARRY = getFullSkillId('advanced', 'cascadingCarry')
const CASCADING_BORROW = getFullSkillId('advanced', 'cascadingBorrow')

const MASTERED: SkillEvidence = { isSolid: true, opportunities: 5 }
const WEAK: SkillEvidence = { isSolid: false, opportunities: 5 }
const UNPRACTICED: SkillEvidence = { isSolid: true, opportunities: 0 } // 0-opp "non-blocking" default

/** Every staged skill starts unpracticed; callers mark specific ones. */
function baseEvidence(): Map<string, SkillEvidence> {
  const m = new Map<string, SkillEvidence>()
  for (const id of ALL_STAGED_SKILL_IDS) m.set(id, UNPRACTICED)
  return m
}
function set(m: Map<string, SkillEvidence>, ids: string[], e: SkillEvidence) {
  for (const id of ids) m.set(id, e)
}

const noVeto = new Set<string>()

describe('stageRank', () => {
  it('orders the curriculum, splitting advanced by operation', () => {
    expect(stageRank(CAT.basic[0])).toBe(0)
    expect(stageRank(CAT.five[0])).toBe(1)
    expect(stageRank(CAT.ten[0])).toBe(2)
    expect(stageRank(CASCADING_CARRY)).toBe(3)
    expect(stageRank(CAT.fiveSub[0])).toBe(4)
    expect(stageRank(CAT.tenSub[0])).toBe(5)
    expect(stageRank(CASCADING_BORROW)).toBe(6)
    expect(stageRank('not.a.real.skill')).toBeNull()
  })
})

describe('computeFrontierRank', () => {
  it('pure beginner (nothing practiced) → frontier 0', () => {
    expect(computeFrontierRank(baseEvidence())).toBe(0)
  })

  it('basic mastered, rest untouched → frontier 1', () => {
    const ev = baseEvidence()
    set(ev, CAT.basic, MASTERED)
    expect(computeFrontierRank(ev)).toBe(1)
  })

  it('cascading stages never block the frontier', () => {
    const ev = baseEvidence()
    set(ev, [...CAT.basic, ...CAT.five, ...CAT.ten], MASTERED)
    // cascadingCarry (stage 3) NEVER practiced, subtraction untouched
    expect(computeFrontierRank(ev)).toBe(4) // frontier sailed past the exempt stage 3
  })

  it('MUST-FIX: a partially-explored stage is NOT vacuously mastered', () => {
    const ev = baseEvidence()
    set(ev, [...CAT.basic, ...CAT.five], MASTERED)
    // only 3 of 9 tenComplements have real evidence; the other 6 remain unpracticed
    set(ev, CAT.ten.slice(0, 3), MASTERED)
    // Without the opportunities>0 requirement the unpracticed 6 would read as "solid"
    // and vault the whole stage. The fix holds the frontier at 2.
    expect(computeFrontierRank(ev)).toBe(2)
  })

  it('a weak (practiced-but-not-solid) skill stops the frontier at its stage', () => {
    const ev = baseEvidence()
    set(ev, CAT.basic, MASTERED)
    set(ev, [CAT.five[0]], WEAK)
    set(ev, CAT.five.slice(1), MASTERED)
    expect(computeFrontierRank(ev)).toBe(1)
  })

  it('fully consolidated child → frontier reaches the top (7)', () => {
    const ev = baseEvidence()
    set(
      ev,
      [
        ...CAT.basic,
        ...CAT.five,
        ...CAT.ten,
        CASCADING_CARRY,
        ...CAT.fiveSub,
        ...CAT.tenSub,
        CASCADING_BORROW,
      ],
      MASTERED
    )
    expect(computeFrontierRank(ev)).toBe(7)
  })
})

describe('deriveLinearReadyFromEvidence', () => {
  const allActive = new Set(ALL_STAGED_SKILL_IDS)

  it('owner milestone: addition graduates when the child crosses into subtraction-with-regrouping', () => {
    const ev = baseEvidence()
    set(ev, [...CAT.basic, ...CAT.five, ...CAT.ten, CASCADING_CARRY], MASTERED)
    set(ev, CAT.fiveSub, WEAK) // just became active, still in progress
    const active = new Set([
      ...CAT.basic,
      ...CAT.five,
      ...CAT.ten,
      CASCADING_CARRY,
      ...CAT.fiveSub,
    ])
    const ready = deriveLinearReadyFromEvidence({
      evidenceBySkill: ev,
      activeSkillIds: active,
      vetoedCategories: noVeto,
    })
    expect([...ready].sort()).toEqual(
      [...CAT.basic, ...CAT.five, ...CAT.ten, CASCADING_CARRY].sort()
    )
  })

  it('mid-category child: mastered-but-mid-stage skills do NOT graduate', () => {
    const ev = baseEvidence()
    set(ev, [...CAT.basic, ...CAT.five], MASTERED)
    set(ev, CAT.ten.slice(0, 3), MASTERED) // partial tenComplements
    const ready = deriveLinearReadyFromEvidence({
      evidenceBySkill: ev,
      activeSkillIds: allActive,
      vetoedCategories: noVeto,
    })
    for (const id of CAT.ten) expect(ready.has(id)).toBe(false)
    expect(ready.has(CAT.basic[0])).toBe(true)
    expect(ready.has(CAT.five[0])).toBe(true)
  })

  it('cascading past the frontier still needs its own evidence to enter the pool', () => {
    const ev = baseEvidence()
    set(ev, [...CAT.basic, ...CAT.five, ...CAT.ten], MASTERED)
    // cascadingCarry (rank 3) is below the frontier (4) but was never practiced
    const ready = deriveLinearReadyFromEvidence({
      evidenceBySkill: ev,
      activeSkillIds: allActive,
      vetoedCategories: noVeto,
    })
    expect(ready.has(CASCADING_CARRY)).toBe(false)
    expect(ready.has(CAT.ten[0])).toBe(true)
  })

  it('a stray active downstream skill cannot pull the frontier forward (Edge 3)', () => {
    const ev = baseEvidence()
    set(ev, CAT.basic, MASTERED)
    set(ev, [CAT.five[0]], MASTERED) // fiveComplements only partial → stage 1 incomplete
    set(ev, [CAT.tenSub[0]], MASTERED) // a stray subtraction skill got drilled in a tutorial
    const active = new Set([...CAT.basic, ...CAT.five, CAT.tenSub[0]])
    const ready = deriveLinearReadyFromEvidence({
      evidenceBySkill: ev,
      activeSkillIds: active,
      vetoedCategories: noVeto,
    })
    expect(ready.has(CAT.tenSub[0])).toBe(false)
    for (const id of CAT.basic) expect(ready.has(id)).toBe(true)
    expect(ready.has(CAT.five[0])).toBe(false) // rank 1, not below frontier 1
  })

  it('a per-category veto keeps that category off number sentences', () => {
    const ev = baseEvidence()
    set(ev, [...CAT.basic, ...CAT.five, ...CAT.ten, CASCADING_CARRY], MASTERED)
    set(ev, CAT.fiveSub, WEAK)
    const active = new Set([...CAT.basic, ...CAT.five, ...CAT.ten, CASCADING_CARRY])
    const ready = deriveLinearReadyFromEvidence({
      evidenceBySkill: ev,
      activeSkillIds: active,
      vetoedCategories: new Set(['tenComplements']),
    })
    for (const id of CAT.ten) expect(ready.has(id)).toBe(false)
    expect(ready.has(CAT.basic[0])).toBe(true)
    expect(ready.has(CASCADING_CARRY)).toBe(true)
  })

  it("MUST-FIX: respects the teacher's manual 'none' (off means off)", () => {
    const ev = baseEvidence()
    set(ev, [...CAT.basic, ...CAT.five, ...CAT.ten, CASCADING_CARRY], MASTERED)
    set(ev, CAT.fiveSub, WEAK)
    const offSkill = CAT.ten[0]
    // offSkill is mastered + past the frontier, but the teacher turned it off (absent from active)
    const active = new Set([
      ...CAT.basic,
      ...CAT.five,
      ...CAT.ten.slice(1),
      CASCADING_CARRY,
    ])
    const ready = deriveLinearReadyFromEvidence({
      evidenceBySkill: ev,
      activeSkillIds: active,
      vetoedCategories: noVeto,
    })
    expect(ready.has(offSkill)).toBe(false)
    expect(ready.has(CAT.ten[1])).toBe(true)
  })

  it('pure beginner → nothing graduates', () => {
    const ready = deriveLinearReadyFromEvidence({
      evidenceBySkill: baseEvidence(),
      activeSkillIds: allActive,
      vetoedCategories: noVeto,
    })
    expect(ready.size).toBe(0)
  })
})

describe('deriveLinearReadySkills (adapter)', () => {
  it('MUST-FIX: classic mode / empty history / undefined BKT → empty, no crash', () => {
    const result = deriveLinearReadySkills({
      skillMastery: [
        { skillId: CAT.basic[0], practiceLevel: 'visual' },
        { skillId: CAT.five[0], practiceLevel: 'abacus' },
        { skillId: CAT.ten[0], practiceLevel: 'none' },
      ],
      problemHistory: [],
      bktResults: undefined,
      vetoedCategories: noVeto,
    })
    expect(result.size).toBe(0)
  })
})

describe('groupLinearReadyByCategory', () => {
  it('buckets skill ids by their category', () => {
    const grouped = groupLinearReadyByCategory([CAT.basic[0], CAT.five[0], CAT.five[1]])
    expect(grouped.get('basic')).toEqual([CAT.basic[0]])
    expect(grouped.get('fiveComplements')?.sort()).toEqual([CAT.five[0], CAT.five[1]].sort())
    expect(grouped.has('tenComplements')).toBe(false)
  })
})
