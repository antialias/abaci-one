#!/usr/bin/env npx tsx
/**
 * Phase 1w re-baseline: what giving wrong tries a weight does to every seeded
 * profile (session architecture plan §7 Phase 1w, §8 Q10, §10 P1w-*).
 *
 * Seeds every profile in `TEST_PROFILES` with the real seeder (`createTestStudent`,
 * with the seed CLI's tuning loop) into a throwaway libSQL file under the OS temp
 * dir, stores the seeded answers with the weights main's server stamps (the
 * seeder stamps none), reads the history back the way the app does (both
 * evidence paths: `getRecentSessionResults` and `batchGetRecentBktEvidence`, 100
 * sessions), appends simulated next sessions, and computes pKnown,
 * classification, readiness and the linear-gate verdict under five readings:
 *
 *   A    main today: main's reader (`masteryWeight ?? 1.0`) over that history.
 *   A+S  A plus the next session, stamped as main stamps it.
 *   B+S  forward-only, the alternative not taken: main's reader, the next
 *        session stamped by Phase 1w's weightOfTry.
 *   C    retroactive, as built, deploy day: the code itself
 *        (`computeBktFromHistory`'s default reader, `evidenceWeightOf`) over the
 *        history as stored, no new session.
 *   C+S  C after the next session, stamped by weightOfTry.
 *
 * Main's reader is the same `computeBktFromHistory` with `weighTry` set to the
 * stored weight, which is main's line exactly.
 *
 * Never touches data/sqlite.db: it refuses to run with DATABASE_URL set and points
 * the app's db at a fresh temp file it deletes afterwards. Math.random is seeded
 * per profile, so the output is the same on every run.
 *
 * Usage (from apps/web):
 *   npx tsx scripts/rebaseline-try-weights.ts [--out /tmp/1w-rebaseline.md]
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import Module from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: { out: { type: 'string', default: '/tmp/1w-rebaseline.md' } },
  strict: true,
})

if (process.env.DATABASE_URL) {
  console.error('Refusing to run with DATABASE_URL set: this script seeds its own temp database.')
  process.exit(1)
}
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = mkdtempSync(join(tmpdir(), '1w-rebaseline-'))
process.env.DATABASE_URL = `file:${join(tempDir, 'seed.db')}`

// `server-only` (imported by evidence-query) is a Next alias, not an installed
// package: resolve it to an empty module, as the tests mock it
const serverOnlyStub = join(tempDir, 'server-only.js')
writeFileSync(serverOnlyStub, '')
const resolver = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string
}
const resolveFilename = resolver._resolveFilename
resolver._resolveFilename = (request, ...rest) =>
  request === 'server-only' ? serverOnlyStub : resolveFilename.call(Module, request, ...rest)

/** First tries in the simulated next session: ~15 minutes at DEFAULT_SECONDS_PER_PROBLEM (45 s) */
const NEXT_SESSION_FIRST_TRIES = 20
/** Even a strong kid slips now and then */
const MIN_ERROR_RATE = 0.05
/** Sessions simulated to see whether forward-only catches up with retroactive */
const CONVERGENCE_SESSIONS = 5
/** Quoted in the summary; checked against the computed table when the report is written */
const MAIN_INFLATION_EXAMPLE_PROFILE = '🔴 Multi-Skill Deficient'
const MAIN_INFLATION_EXAMPLE_SKILL = 'basic.directAddition'
/** Why a profile's as-stored reading differs from variant C (found by reading its rows) */
const STORED_DIFFERS_WHY: Record<string, string> = {}
const SESSION_HISTORY_DEPTH = 100

type Variant = 'A' | 'A+S' | 'B+S' | 'C' | 'C+S'
const VARIANTS: Variant[] = ['A', 'A+S', 'B+S', 'C', 'C+S']

async function main() {
  // Imported after DATABASE_URL points at the temp file
  const { migrate } = await import('drizzle-orm/libsql/migrator')
  const { db, schema } = await import('../src/db')
  const { createTestStudent } = await import('../src/lib/seed/create-student')
  const { TEST_PROFILES } = await import('../src/lib/seed/profiles')
  const { applyTuningAdjustments, checkSuccessCriteria } = await import('../src/lib/seed/helpers')
  const { designSequenceForClassification } = await import('../src/lib/seed/bkt-simulation')
  const { generateRealisticProblems } = await import('../src/lib/seed/problem-generation')
  const { withSeededRandomAsync } = await import('../src/lib/SeededRandom')
  const { getRecentSessionResults } = await import('../src/lib/curriculum/session-planner')
  const { batchGetRecentBktEvidence } = await import('../src/lib/curriculum/bkt/evidence-query')
  const { eq } = await import('drizzle-orm')
  const { computeBktFromHistory } = await import('../src/lib/curriculum/bkt')
  const { BKT_THRESHOLDS, WEAK_SKILL_THRESHOLDS } = await import(
    '../src/lib/curriculum/config/bkt-integration'
  )
  const { responseTimeWeight } = await import('../src/lib/curriculum/bkt/evidence-quality')
  const { assessSkillReadiness } = await import('../src/lib/curriculum/skill-readiness')
  const { deriveLinearGateState, DEFAULT_LINEAR_GATE_THRESHOLDS } = await import(
    '../src/lib/curriculum/linear-gate'
  )
  const { getSkillCategory } = await import('../src/constants/skillCategories')
  const { calculateMasteryWeight, MAX_RETRY_EPOCHS } = await import(
    '../src/db/schema/session-plan-helpers'
  )
  const { weightOfTry } = await import('../src/lib/curriculum/try-weight')

  type Row = import('../src/lib/curriculum/session-planner').ProblemResultWithContext
  type SlotResult = import('../src/db/schema/session-plans').SlotResult
  type SkillConfig = import('../src/lib/seed/types').SkillConfig
  type Profile = import('../src/lib/seed/types').TestStudentProfile
  type Cls = 'weak' | 'developing' | 'strong'

  await migrate(db, { migrationsFolder: join(webRoot, 'drizzle') })
  const userId = 'rebaseline-user'
  await db.insert(schema.users).values({ id: userId, guestId: 'rebaseline-guest' })

  // ---------------------------------------------------------------------------
  // Weights
  // ---------------------------------------------------------------------------

  const kindOf = (r: SlotResult) =>
    r.kind ??
    (r.isManualRedo ? 'do_over' : r.isRetry || (r.epochNumber ?? 0) > 0 ? 'retry' : 'first')
  const roundOf = (r: SlotResult) => r.round ?? (r.isManualRedo ? 1 : (r.epochNumber ?? 0))

  /** What origin/main's server stamps (recordSlotResult / recordRedoResult) */
  const mainWeight = (r: SlotResult) =>
    kindOf(r) === 'do_over'
      ? r.isCorrect
        ? 1
        : 0
      : calculateMasteryWeight(r.isCorrect, kindOf(r) === 'retry' ? roundOf(r) : 0)
  /** Phase 1w */
  const newWeight = (r: SlotResult) =>
    weightOfTry({
      kind: kindOf(r),
      round: roundOf(r),
      isCorrect: r.isCorrect,
      practiceOnly: r.practiceOnly === true,
    })
  const stamp = <R extends Row | SlotResult>(rows: R[], w: (r: R) => number): R[] =>
    rows.map((r) => ({ ...r, masteryWeight: w(r) }))
  /** origin/main's reader (compute-bkt: `result.masteryWeight ?? 1.0`), for A and B */
  const storedWeight = (r: { masteryWeight?: number }) => r.masteryWeight ?? 1.0

  // ---------------------------------------------------------------------------
  // Seeding (the seed CLI's tuning loop around createTestStudent)
  // ---------------------------------------------------------------------------

  /** createTestStudent's ensureAllPracticingHaveHistory fill, for the session simulator */
  function effectiveHistory(profile: Profile, skillHistory: SkillConfig[]): SkillConfig[] {
    if (!profile.ensureAllPracticingHaveHistory) return skillHistory
    const have = new Set(skillHistory.map((c) => c.skillId))
    return [
      ...skillHistory,
      ...profile.practicingSkills
        .filter((id) => !have.has(id))
        .map((skillId) => ({ skillId, targetClassification: 'strong' as const, problems: 15 })),
    ]
  }

  async function seed(profile: Profile) {
    let skillHistory = profile.skillHistory
    let playerId = ''
    for (let round = 1; round <= 3; round++) {
      const created = await createTestStudent(profile, userId, skillHistory)
      playerId = created.playerId
      const { success } = checkSuccessCriteria(created.classifications, profile.successCriteria)
      if (success || round === 3 || !profile.tuningAdjustments) break
      skillHistory = applyTuningAdjustments(skillHistory, profile.tuningAdjustments)
    }
    const asSeeded = await getRecentSessionResults(playerId, SESSION_HISTORY_DEPTH)
    // Store the answers as the live server on main stamps them (the seeder stamps
    // no weight), so the history below is what a kid of this profile has in prod
    const plans = await db
      .select({ id: schema.sessionPlans.id, results: schema.sessionPlans.results })
      .from(schema.sessionPlans)
      .where(eq(schema.sessionPlans.playerId, playerId))
    for (const plan of plans) {
      await db
        .update(schema.sessionPlans)
        .set({ results: stamp(plan.results, mainWeight) })
        .where(eq(schema.sessionPlans.id, plan.id))
    }
    // Both evidence paths, as the app reads them
    const history = await getRecentSessionResults(playerId, SESSION_HISTORY_DEPTH)
    const lean = (await batchGetRecentBktEvidence([playerId], SESSION_HISTORY_DEPTH)).get(playerId)
    return { asSeeded, history, lean: lean ?? [], configs: effectiveHistory(profile, skillHistory) }
  }

  // ---------------------------------------------------------------------------
  // The simulated next session
  // ---------------------------------------------------------------------------

  /**
   * One more session, about 15 minutes: NEXT_SESSION_FIRST_TRIES first tries
   * (DEFAULT_SECONDS_PER_PROBLEM is 45 s), dealt round-robin over the profile's
   * seeded skills. The kid's error rate on a skill is the error rate of that
   * skill's seeded answer sequence (at least MIN_ERROR_RATE). Mistakes fall where
   * a running sum of those rates crosses a whole number (started at 0.5), so the
   * session holds Σ rates mistakes, spread through it. Each wrong first try is
   * retried: right in round 1 when the skill's accuracy ≥ 0.5, else wrong again
   * and right in round 2 when ≥ 0.25, else wrong (answer shown).
   */
  function nextSession(configs: SkillConfig[], historyEnd: number, nth = 0): Row[] {
    if (configs.length === 0) return []
    const perSkill = configs.map((config) => {
      const typical =
        ((config.responseTimeMsRange?.min ?? 4000) + (config.responseTimeMsRange?.max ?? 6000)) / 2
      const seq = designSequenceForClassification(
        config.skillId,
        config.problems,
        config.targetClassification,
        (ok) => responseTimeWeight(typical, ok)
      )
      const accuracy = seq.filter(Boolean).length / Math.max(1, seq.length)
      const share = Math.ceil(NEXT_SESSION_FIRST_TRIES / configs.length)
      const problems = generateRealisticProblems(config.skillId, share)
      return { config, accuracy, typical, problems, used: 0 }
    })
    type Skill = (typeof perSkill)[number]

    const rows: Row[] = []
    const sessionId = `next-session-${nth}`
    let t = historyEnd + 24 * 3600_000
    const push = (p: Skill, i: number, isCorrect: boolean, round: number): void => {
      const prob = p.problems[i % p.problems.length]
      t += 10_000
      rows.push({
        slotId: `next-${nth}-${p.config.skillId}-${i}`,
        partNumber: 1,
        slotIndex: rows.length,
        problem: { terms: prob.terms, answer: prob.answer, skillsRequired: prob.skillsUsed },
        studentAnswer: isCorrect ? prob.answer : prob.answer + 1,
        isCorrect,
        responseTimeMs: p.typical,
        skillsExercised: prob.skillsUsed,
        usedOnScreenAbacus: false,
        hadHelp: false,
        incorrectAttempts: isCorrect ? 0 : 1,
        timestamp: new Date(t),
        kind: round === 0 ? 'first' : 'retry',
        round,
        practiceOnly: false,
        epochNumber: round,
        isRetry: round > 0,
        sessionId,
        sessionCompletedAt: new Date(historyEnd + 25 * 3600_000),
        partType: 'linear',
      } as Row)
    }

    const wrong: { p: Skill; i: number }[] = []
    let budget = 0.5
    for (let k = 0; k < NEXT_SESSION_FIRST_TRIES; k++) {
      const p = perSkill[k % perSkill.length]
      const i = p.used++
      budget += Math.max(MIN_ERROR_RATE, 1 - p.accuracy)
      const isWrong = budget >= 1
      if (isWrong) {
        budget -= 1
        wrong.push({ p, i })
      }
      push(p, i, !isWrong, 0)
    }
    // Round r is reached by items still wrong after round r−1
    const rightFrom = [Number.POSITIVE_INFINITY, 0.5, 0.25]
    for (let round = 1; round <= MAX_RETRY_EPOCHS; round++) {
      for (const { p, i } of wrong) {
        if (p.accuracy >= rightFrom[round - 1]) continue // right in an earlier round
        push(p, i, p.accuracy >= rightFrom[round], round)
      }
    }
    return rows
  }

  // ---------------------------------------------------------------------------
  // Readers
  // ---------------------------------------------------------------------------

  interface Reading {
    pKnown: number
    cls: Cls
    confidence: number
    solid: boolean
    gate: boolean
  }

  /** 'main' = origin/main's stored-weight reader; 'phase1w' = the code as built (evidenceWeightOf) */
  type Reader = 'main' | 'phase1w'
  const bktOf = (
    rows: readonly Parameters<typeof computeBktFromHistory>[0][number][],
    reader: Reader
  ) =>
    computeBktFromHistory(rows, {
      confidenceThreshold: BKT_THRESHOLDS.confidence,
      ...(reader === 'main' ? { weighTry: storedWeight } : {}),
    })
  function read(rows: Row[], skills: string[], reader: Reader): Map<string, Reading> {
    const bkt = bktOf(rows, reader)
    const bySkill = new Map(bkt.skills.map((s) => [s.skillId, s]))
    const categories = new Set(
      skills.map((s) => getSkillCategory(s)).filter((c): c is NonNullable<typeof c> => c !== null)
    )
    const gate = deriveLinearGateState({
      problemHistory: rows,
      categories,
      thresholds: DEFAULT_LINEAR_GATE_THRESHOLDS,
    })
    const out = new Map<string, Reading>()
    for (const skillId of skills) {
      const s = bySkill.get(skillId)
      const category = getSkillCategory(skillId)
      out.set(skillId, {
        pKnown: s?.pKnown ?? Number.NaN,
        cls: (s?.masteryClassification ?? 'developing') as Cls,
        confidence: s?.confidence ?? 0,
        solid: assessSkillReadiness(skillId, rows, s).isSolid,
        gate: category ? (gate.get(category)?.passed ?? false) : false,
      })
    }
    return out
  }

  const isWeakForMode = (r: Reading) =>
    r.confidence >= WEAK_SKILL_THRESHOLDS.confidenceThreshold &&
    r.pKnown < WEAK_SKILL_THRESHOLDS.pKnownThreshold

  // ---------------------------------------------------------------------------
  // Run every profile
  // ---------------------------------------------------------------------------

  interface SkillRow {
    profile: string
    skillId: string
    target: Cls | null
    practicing: boolean
    wrongTries: number
    countedTries: number
    nextWrong: number
    readings: Record<Variant, Reading>
    /** After CONVERGENCE_SESSIONS simulated sessions: main, forward-only, retroactive */
    later: Record<'A' | 'B' | 'C', Reading>
  }
  interface ProfileResult {
    profile: Profile
    rows: SkillRow[]
    /** Skills whose as-seeded (unstamped) pKnown differs from variant C */
    storedDiffers: string[]
    /** Skills whose C differs from the simulation the first table used (history restamped by weightOfTry, read as stored) */
    simulatedDiffers: string[]
    /** The SQL evidence path gives the same BKT as the in-JS history path, under Phase 1w */
    pathsAgree: boolean
    nextSessionSize: number
  }

  const results: ProfileResult[] = []
  for (const [index, profile] of TEST_PROFILES.entries()) {
    const { asSeeded, history, lean, configs, sessions } = await withSeededRandomAsync(
      9000 + index,
      async () => {
        const seeded = await seed(profile)
        const end = Math.max(0, ...seeded.history.map((r) => new Date(r.timestamp).getTime()))
        const day = 24 * 3600_000
        return {
          ...seeded,
          sessions: Array.from({ length: CONVERGENCE_SESSIONS }, (_, k) =>
            nextSession(seeded.configs, end + k * 2 * day, k)
          ),
        }
      }
    )
    const next = sessions[0]
    const later = sessions.flat()

    const skills = [
      ...new Set([...history, ...later].flatMap((r) => r.skillsExercised ?? [])),
    ].sort()
    // The history as stored in prod (main's stamps). A and B read it with main's
    // reader; C with the code as built. Simulated sessions are stamped by the
    // server that records them: main's, or Phase 1w's weightOfTry
    const nextMain = stamp(next, mainWeight)
    const nextNew = stamp(next, newWeight)
    const variants: Record<Variant, Map<string, Reading>> = {
      A: read(history, skills, 'main'),
      'A+S': read([...history, ...nextMain], skills, 'main'),
      'B+S': read([...history, ...nextNew], skills, 'main'),
      C: read(history, skills, 'phase1w'),
      'C+S': read([...history, ...nextNew], skills, 'phase1w'),
    }
    const laterMain = stamp(later, mainWeight)
    const laterNew = stamp(later, newWeight)
    const converged: Record<'A' | 'B' | 'C', Map<string, Reading>> = {
      A: read([...history, ...laterMain], skills, 'main'),
      B: read([...history, ...laterNew], skills, 'main'),
      C: read([...history, ...laterNew], skills, 'phase1w'),
    }
    const pKnownDiffers = (other: Map<string, Reading>) =>
      skills.filter(
        (s) => Math.abs((other.get(s)?.pKnown ?? 0) - (variants.C.get(s)?.pKnown ?? 0)) >= 1e-9
      )
    // The seeder stamps no masteryWeight, so BKT reads its wrong rows at 1.0: check
    // that the seeded students as stored are exactly variant C
    const storedDiffers = pKnownDiffers(read(asSeeded, skills, 'phase1w'))
    // The first table simulated C (every row restamped by weightOfTry, read as stored)
    const simulatedDiffers = pKnownDiffers(read(stamp(history, newWeight), skills, 'main'))
    const pathsAgree =
      JSON.stringify(bktOf(lean, 'phase1w')) === JSON.stringify(bktOf(history, 'phase1w'))

    const targets = new Map(configs.map((c) => [c.skillId, c.targetClassification as Cls]))
    const rows: SkillRow[] = skills.map((skillId) => {
      const mine = history.filter((r) => r.skillsExercised?.includes(skillId))
      return {
        profile: profile.name,
        skillId,
        target: targets.get(skillId) ?? null,
        practicing: profile.practicingSkills.includes(skillId),
        wrongTries: mine.filter((r) => !r.isCorrect).length,
        countedTries: mine.length,
        nextWrong: next.filter((r) => !r.isCorrect && r.skillsExercised?.includes(skillId)).length,
        readings: Object.fromEntries(VARIANTS.map((v) => [v, variants[v].get(skillId)!])) as Record<
          Variant,
          Reading
        >,
        later: {
          A: converged.A.get(skillId)!,
          B: converged.B.get(skillId)!,
          C: converged.C.get(skillId)!,
        },
      }
    })
    results.push({
      profile,
      rows,
      storedDiffers,
      simulatedDiffers,
      pathsAgree,
      nextSessionSize: next.length,
    })
    process.stderr.write(
      `seeded ${index + 1}/${TEST_PROFILES.length} ${profile.name}${storedDiffers.length ? ` (as seeded ≠ C: ${storedDiffers.join(', ')})` : ''}${simulatedDiffers.length ? ` (simulated C ≠ C: ${simulatedDiffers.join(', ')})` : ''}${pathsAgree ? '' : ' (SQL ≠ in-JS path)'}\n`
    )
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------

  const all = results.flatMap((r) => r.rows)
  const abbrev: Record<Cls, string> = { strong: 'S', developing: 'D', weak: 'W' }
  const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : '—')
  const yn = (b: boolean) => (b ? 'Y' : 'n')
  const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(3)}`

  const solidCount = (v: Variant) => all.filter((r) => r.readings[v].solid).length

  function compare(from: Variant, to: Variant) {
    const moves = new Map<string, number>()
    let changed = 0
    let solidFlips = 0
    let solidUp = 0
    let gateFlips = 0
    let towardTarget = 0
    let awayFromTarget = 0
    let upward = 0
    const rank: Record<Cls, number> = { weak: 0, developing: 1, strong: 2 }
    for (const r of all) {
      const a = r.readings[from]
      const b = r.readings[to]
      if (a.cls !== b.cls) {
        changed++
        const key = `${a.cls} → ${b.cls}`
        moves.set(key, (moves.get(key) ?? 0) + 1)
        if (rank[b.cls] > rank[a.cls]) upward++
        if (r.target && b.cls === r.target) towardTarget++
        else if (r.target && a.cls === r.target) awayFromTarget++
      }
      if (a.solid !== b.solid) {
        solidFlips++
        if (b.solid) solidUp++
      }
      if (a.gate !== b.gate) gateFlips++
    }
    const largest = [...all]
      .filter((r) => Number.isFinite(r.readings[from].pKnown))
      .sort(
        (x, y) =>
          Math.abs(y.readings[to].pKnown - y.readings[from].pKnown) -
          Math.abs(x.readings[to].pKnown - x.readings[from].pKnown)
      )
      .slice(0, 5)
    const away = all.filter(
      (r) => r.target && r.readings[from].cls === r.target && r.readings[to].cls !== r.target
    )
    const strongLost = all.filter(
      (r) =>
        r.target === 'strong' &&
        r.readings[from].cls === 'strong' &&
        r.readings[to].cls !== 'strong'
    ).length
    return {
      changed,
      moves,
      solidFlips,
      solidUp,
      gateFlips,
      largest,
      towardTarget,
      awayFromTarget,
      away,
      strongLost,
      upward,
    }
  }

  /** The machine-checkable parts of each profile's intention */
  function expectations(p: ProfileResult, v: Variant) {
    const misses: string[] = []
    for (const r of p.rows) {
      if (r.target && r.readings[v].cls !== r.target) {
        misses.push(`${r.skillId} ${r.target}→${r.readings[v].cls}`)
      }
    }
    const counts = { weak: 0, developing: 0, strong: 0 }
    for (const r of p.rows) counts[r.readings[v].cls]++
    const criteria = checkSuccessCriteria(counts, p.profile.successCriteria)
    const anyWeak = p.rows.some((r) => r.practicing && isWeakForMode(r.readings[v]))
    const notes = p.profile.intentionNotes.toLowerCase()
    const promisesNoWeak = notes.includes('no weak skills')
    const modeMiss =
      (p.profile.expectedSessionMode === 'remediation' && !anyWeak) ||
      (p.profile.expectedSessionMode !== undefined &&
        p.profile.expectedSessionMode !== 'remediation' &&
        anyWeak) ||
      (promisesNoWeak && anyWeak)
    return { misses, criteriaOk: criteria.success, criteriaWhy: criteria.reasons, modeMiss }
  }

  const example = all.find(
    (r) =>
      r.profile === MAIN_INFLATION_EXAMPLE_PROFILE && r.skillId === MAIN_INFLATION_EXAMPLE_SKILL
  )
  const MAIN_INFLATION_EXAMPLE = example
    ? `${example.profile}’s \`${example.skillId}\` (${example.wrongTries} of ${example.countedTries} seeded tries wrong) reads ${fmt(example.readings.A.pKnown)} on main, and ${fmt(example.readings['A+S'].pKnown)} (${example.readings['A+S'].cls}) after a session with ${example.nextWrong} more wrong tries; Phase 1w reads ${fmt(example.readings['C+S'].pKnown)} after it (${fmt(example.readings.C.pKnown)} on deploy day)`
    : 'a chronically wrong skill climbs'

  const lines: string[] = []
  const emit = (s = '') => lines.push(s)
  const comparisons: [string, Variant, Variant][] = [
    ['Retroactive (built), deploy day, no new session (A → C)', 'A', 'C'],
    ['Retroactive (built), after the next session (A+S → C+S)', 'A+S', 'C+S'],
    ['Forward-only (not taken), after the next session (A+S → B+S)', 'A+S', 'B+S'],
  ]

  const differing = results.filter((r) => r.storedDiffers.length > 0)
  const storedNote = differing.length
    ? `; the exception${differing.length > 1 ? 's' : ''}: ${differing.map((r) => `${r.profile.name} (${r.storedDiffers.length} skill${r.storedDiffers.length > 1 ? 's' : ''}, ${STORED_DIFFERS_WHY[r.profile.name] ?? 'see the table'})`).join(', ')}`
    : ''
  const sizes = results.map((r) => r.nextSessionSize).filter((n) => n > 0)

  emit('# Phase 1w re-baseline: wrong tries carry evidence')
  emit()
  emit(
    `Generated by \`npx tsx scripts/rebaseline-try-weights.ts\` (apps/web) over all ${results.length} profiles in \`TEST_PROFILES\`; ${all.length} profile × skill rows. Deterministic: Math.random is seeded per profile. Plan: [plan-of-record.md](./plan-of-record.md) §7 Phase 1w, §8 Q10, §10 P1w-*.`
  )
  emit()
  emit('## Summary')
  emit()
  {
    const fwd = compare('A+S', 'B+S')
    const day = compare('A', 'C')
    const differ5 = all.filter((r) => r.later.B.cls !== r.later.C.cls).length
    const holdCount = (v: Variant) =>
      results.filter((p) => {
        const e = expectations(p, v)
        return e.misses.length === 0 && e.criteriaOk && !e.modeMiss
      }).length
    const modeMisses = (v: Variant) =>
      results.filter((p) => expectations(p, v).modeMiss).map((p) => p.profile.name)
    const list = (xs: string[]) => (xs.length ? xs.join(', ') : 'none')
    emit('In one minute:')
    emit()
    emit(
      `- **Retroactive, built (the owner's choice, 2026-11-26), deploy day:** ${day.changed} rows reclassify before the kid practises again (${day.towardTarget} onto the intended class, ${day.awayFromTarget} off it); readiness ${day.solidFlips}, gate ${day.gateFlips}. Computed by the code as built over the history as main stores it; identical to the simulation in the table the owner chose from on all ${all.length} rows, and the two evidence paths agree on ${results.filter((r) => r.pathsAgree).length} of ${results.length} profiles.`
    )
    emit(
      `- **Forward-only (not taken), next session:** ${fwd.changed} of ${all.length} profile × skill rows reclassify, ${fwd.upward === 0 ? 'all downward' : `${fwd.changed - fwd.upward} down and ${fwd.upward} up`}, ${fwd.towardTarget} of them onto the profile’s intended class and ${fwd.awayFromTarget} off it. No seeded-strong skill stops being strong. Readiness flips: ${fwd.solidFlips}. Linear-gate flips: ${fwd.gateFlips} (the gate reads no weight). After ${CONVERGENCE_SESSIONS} sessions it still differs from retroactive on ${differ5} rows.`
    )
    emit(
      `- **Largest moves** are kids who keep missing and whom main reads as strong, because a wrong try weighs 0 there and right retries still add: ${MAIN_INFLATION_EXAMPLE}.`
    )
    emit(
      `- **Intentions:** profiles whose stated expectations all hold: main as production stamps it ${holdCount('A')} of ${results.length}, after the next session main ${holdCount('A+S')}, forward-only ${holdCount('B+S')}, retroactive ${holdCount('C+S')} (retroactive on history alone ${holdCount('C')}: the seeded histories were designed for full-weight wrong answers). Session-mode promise broken: main ${list(modeMisses('A+S'))}; forward-only ${list(modeMisses('B+S'))}; retroactive ${list(modeMisses('C+S'))}.`
    )
    emit(
      `- **Read the seeder note below before the numbers:** the seeded students carry no stored weights, so the app already showed them under the retroactive rule before Phase 1w; column A is how a real kid with the same answers reads on main.`
    )
    emit()
  }
  emit(
    '**The rule.** Phase 1w weighs a try 1/2^round right or wrong: first try 1, retry 0.5 / 0.25, counted do-over 1/2^round (the first do-over of a once-wrong item 0.5, was 1.0, §10 P1-9), practice-only 0. Main weighs a wrong try 0, so a wrong answer never lowers pKnown.'
  )
  emit()
  emit(
    '**A note on the seeder, read first.** The seeder writes no `masteryWeight`, and BKT reads a missing weight as 1.0, so every seeded wrong answer already counts in full: the seeded students, as the app shows them today, are variant C exactly (checked per skill: ' +
      `${results.filter((r) => r.storedDiffers.length === 0).length}/${results.length} profiles identical${storedNote}). Their histories were designed (\`designSequenceForClassification\`) under that full-weight assumption. A real kid's rows are stamped by the server, wrong = 0, so this script stores the seeded answers with main's stamps before reading them back; A is what the same answers mean on main in production, and C is what Phase 1w makes of exactly those stored rows.`
  )
  emit()
  {
    const simulated = results.filter((r) => r.simulatedDiffers.length > 0)
    const agree = results.filter((r) => r.pathsAgree).length
    emit(
      `**How C is computed.** Through the code as built, not a model of it: the seeded history is stored with main's stamps (wrong 0, correct 1/2^epoch), read back by \`getRecentSessionResults\`, and passed to \`computeBktFromHistory\`, whose reader \`evidenceWeightOf\` re-derives each wrong row's weight from its kind and round. The SQL evidence path (\`batchGetRecentBktEvidence\`) gives the same BKT state on ${agree} of ${results.length} profiles. Against the first version of this table, which simulated C by restamping every row with \`weightOfTry\` and reading the stored weight: ${simulated.length === 0 ? `identical on all ${all.length} rows (the seeded history holds only first tries, and the simulated sessions' rows are stamped by \`weightOfTry\` either way)` : `different on ${simulated.reduce((n, r) => n + r.simulatedDiffers.length, 0)} rows: ${simulated.map((r) => `${r.profile.name} (${r.simulatedDiffers.join(', ')})`).join('; ')}`}.`
    )
    emit()
  }
  emit(
    `**The next session (S).** About 15 minutes: ${NEXT_SESSION_FIRST_TRIES} first tries dealt round-robin over the profile's seeded skills, linear part. The kid's error rate on a skill is its seeded sequence's error rate (at least ${MIN_ERROR_RATE}); mistakes are spread through the session by a running sum of those rates, so a strong kid makes one or two and a weak one most. Each mistake is retried: right in round 1 if the skill's seeded accuracy ≥ 0.5, else wrong, then right in round 2 if ≥ 0.25. ${sizes.length} profiles get a session of ${Math.min(...sizes)}–${Math.max(...sizes)} tries (the brand-new student has no skills to practise). Compare B+S and C+S with A+S, not with A: S moves every variant, and the gate and readiness changes from A to A+S are S, not the rule.`
  )
  emit()
  for (const [title, from, to] of comparisons) {
    const c = compare(from, to)
    emit(`**${title}.**`)
    const moveText = [...c.moves.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')
    emit(
      `- Classification changes on ${c.changed} of ${all.length} rows${moveText ? `: ${moveText}` : ''}. Of these, ${c.towardTarget} land on the seeded target and ${c.awayFromTarget} leave it${c.away.length ? ` (${c.away.map((r) => `${r.profile} / \`${r.skillId}\` ${r.target} → ${r.readings[to].cls}, ${r.wrongTries}/${r.countedTries} wrong`).join('; ')})` : ''}. Seeded-strong skills that stop being strong: ${c.strongLost}.`
    )
    emit(
      `- Readiness (\`isSolid\`) flips on ${c.solidFlips} rows (${c.solidUp} to solid, ${c.solidFlips - c.solidUp} to not solid; solid rows ${solidCount(from)} → ${solidCount(to)}); linear-gate verdict flips on ${c.gateFlips}.`
    )
    emit(
      `- Largest pKnown moves: ${c.largest
        .map(
          (r) =>
            `${r.profile} / \`${r.skillId}\` ${fmt(r.readings[from].pKnown)} → ${fmt(r.readings[to].pKnown)} (${signed(r.readings[to].pKnown - r.readings[from].pKnown)})`
        )
        .join('; ')}.`
    )
    emit()
  }

  {
    const targeted = all.filter((r) => r.target)
    const onTarget = (k: 'A' | 'B' | 'C') =>
      targeted.filter((r) => r.later[k].cls === r.target).length
    const bcDiffer = all.filter((r) => r.later.B.cls !== r.later.C.cls)
    const bcStillStrong = bcDiffer.filter(
      (r) => r.later.B.cls === 'strong' && r.later.C.cls !== 'strong'
    ).length
    const s0 = (v: Variant) => targeted.filter((r) => r.readings[v].cls === r.target).length
    emit(
      `**Does forward-only catch up?** After ${CONVERGENCE_SESSIONS} simulated sessions like S, forward-only and retroactive still classify ${bcDiffer.length} of ${all.length} rows differently (${bcStillStrong} of them strong under forward-only and not under retroactive). Seeded skills on their target: main ${onTarget('A')}, forward-only ${onTarget('B')}, retroactive ${onTarget('C')} of ${targeted.length} (after one session: ${s0('A+S')}, ${s0('B+S')}, ${s0('C+S')}; seeded history alone: main ${s0('A')}, retroactive ${s0('C')}).`
    )
    emit()
    const deployDay = compare('A', 'C')
    emit(
      `**What surprised us in BKT.** (1) Main’s rule makes a kid who keeps missing read *strong*: a wrong try adds nothing and each right retry (weight 0.5) adds a little, so ${MAIN_INFLATION_EXAMPLE}. Phase 1w fixes that in both variants. (2) BKT saturates: \`bktUpdate\` clamps pKnown at 0.999, and from there one wrong answer only takes it to about 0.99, so under forward-only a skill that main’s zero-weight history pinned near 1 needs a run of mistakes to come down. That is why one session of forward-only leaves most inflated developing skills strong, and why it takes a few sessions to catch up. (3) No seeded-strong skill stops being strong under either variant; the moves are developing and weak skills that main reads too high. (4) Already on main, a weight-0 wrong try still counts as an opportunity and lowers the success rate behind BKT confidence (\`compute-bkt.ts\` increments \`opportunities\` whatever the weight); only pKnown ignores it.`
    )
    emit()
    emit(
      `**Decision: retroactive** (the owner, 2026-11-26, over this table's first recommendation of forward-only; §10 P1w-1). Retroactive is the truer number on day one: weak kids that main reads as strong are corrected before their next session, at the price of the deploy-day jump (${deployDay.changed} of ${all.length} rows reclassify before the kid has practised again). Forward-only would have reached nearly the same place within about ${CONVERGENCE_SESSIONS} sessions (${bcDiffer.length} of ${all.length} rows still differ) and kept the stored weight as the weight. What retroactive costs in the code: one read-time rule, \`evidenceWeightOf\` (\`try-weight.ts\`), which every reader of a weight uses (BKT, both evidence paths, the review panel) and the ledger fold must apply too (§6); a correct row keeps its stored weight, so a pre-Phase-1 correct do-over stays 1.0 (its round needs the item's earlier tries, which a row does not hold), and a pre-Phase-1 wrong do-over weighs as round 1.`
    )
    emit()
  }

  emit(
    '**Why readiness and the gate do not move.** The linear gate reads only `isCorrect` of first tries, never a weight, so no weighting can flip it (the Y→n changes between A and A+S in the tables are the new session’s mistakes). Readiness needs pKnown ≥ 0.85 *and* the consistency dimension (last 5 correct, ≥ 85 % of the last 15), and a skill that passes consistency sits near pKnown 1 under any of these weightings.'
  )
  emit()
  emit(
    '**Intention expectations** (each seeded skill’s target classification, `successCriteria`, and the session-mode promise: `expectedSessionMode`, or “no weak skills” in the notes, checked as “a practicing skill is weak for session-mode”).'
  )
  emit()
  emit('| Profile | A | A+S | B+S | C | C+S |')
  emit('|---|---|---|---|---|---|')
  for (const p of results) {
    const cell = (v: Variant) => {
      const e = expectations(p, v)
      const parts: string[] = []
      if (e.misses.length)
        parts.push(`${e.misses.length} target miss${e.misses.length > 1 ? 'es' : ''}`)
      if (!e.criteriaOk) parts.push('criteria fail')
      if (e.modeMiss) parts.push('mode miss')
      return parts.length ? parts.join(', ') : 'holds'
    }
    const cells = VARIANTS.map(cell)
    if (cells.every((c) => c === 'holds')) continue
    emit(`| ${p.profile.name} | ${cells.join(' | ')} |`)
  }
  const allHold = results.filter((p) =>
    VARIANTS.every((v) => {
      const e = expectations(p, v)
      return e.misses.length === 0 && e.criteriaOk && !e.modeMiss
    })
  )
  emit()
  emit(
    `Profiles not listed hold under every variant (${allHold.length}): ${allHold.map((p) => p.profile.name).join(', ') || 'none'}.`
  )
  emit()
  const clean = all.filter((r) => r.wrongTries === 0)
  emit(
    `**Skills with no wrong tries in their seeded history:** ${clean.length} of ${all.length} rows${clean.length ? `: ${clean.map((r) => `${r.profile} / \`${r.skillId}\` (${r.wrongTries}/${r.countedTries})`).join(', ')}` : ''}. A 0/0 row has no try in the ${SESSION_HISTORY_DEPTH} sessions the app reads (older sessions fall out of the window) and appears only through the next session. Variant C cannot move these rows on deploy day; the next session's mistakes move them in B+S and C+S. They are in the tables below like every other row.`
  )
  emit()
  emit('## Tables')
  emit()
  emit(
    'Per cell: pKnown and classification (S strong ≥ 0.8, D developing, W weak < 0.5; confidence ≥ 0.3 needed for S/W). Readiness = `assessSkillReadiness(...).isSolid` (a skill with no counted non-retry try is trivially solid). Gate = the skill’s category passes `deriveLinearGateState` at the default thresholds. Sequences read A · A+S · B+S · C · C+S. “wrong/tries” counts the seeded history; “next ✗” counts the next session’s wrong tries (first and retry) on the skill. Target is the profile’s seeded target, — for a skill only exercised alongside others; * marks a practicing skill.'
  )
  emit()
  for (const p of results) {
    emit(`### ${p.profile.name}`)
    emit()
    if (p.rows.length === 0) {
      emit('No history: nothing to re-weigh.')
      emit()
      continue
    }
    emit('| Skill | Target | wrong/tries | next ✗ | A | A+S | B+S | C | C+S | Ready | Gate |')
    emit('|---|---|---|---|---|---|---|---|---|---|---|')
    for (const r of p.rows) {
      const cell = (v: Variant) => `${fmt(r.readings[v].pKnown)} ${abbrev[r.readings[v].cls]}`
      emit(
        `| \`${r.skillId}\`${r.practicing ? '*' : ''} | ${r.target ?? '—'} | ${r.wrongTries}/${r.countedTries} | ${r.nextWrong} | ${VARIANTS.map(cell).join(' | ')} | ${VARIANTS.map((v) => yn(r.readings[v].solid)).join(' ')} | ${VARIANTS.map((v) => yn(r.readings[v].gate)).join(' ')} |`
      )
    }
    emit()
  }

  writeFileSync(args.out!, `${lines.join('\n')}\n`)
  process.stderr.write(`wrote ${args.out}\n`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })
