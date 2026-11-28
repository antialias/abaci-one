/**
 * @vitest-environment node
 *
 * The kind conformance suite (practice-kinds §4 K4) for every kind there is:
 * arithmetic and the stub `read_abacus` kind. And the suite can fail: a kind
 * whose `applyTry` ignores a do-over's redemption fails it (the acceptance's
 * mutation test).
 */

import { describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { readAbacusKind } from '@/lib/curriculum/parts/__tests__/fixtures/read-abacus-kind'
import { arithmeticKind } from '@/lib/curriculum/parts/arithmetic/server'
import type { AnyPartKind } from '@/lib/curriculum/parts/kind'
import { getCurrentEphemeralDb } from '../journey-simulator/EphemeralDatabase'
import { arithmeticFixtures, readAbacusFixtures } from './fixtures'
import { conformanceSuite, failingChecks } from './suite'

vi.mock('server-only', () => ({}))
vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))
vi.mock('@/lib/session-share', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session-share')>()),
  revokeSharesForSession: vi.fn(async () => {}),
}))
const { recordSkillAttemptsWithHelp } = vi.hoisted(() => ({
  recordSkillAttemptsWithHelp: vi.fn(async () => []),
}))
vi.mock('@/lib/curriculum/progress-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/curriculum/progress-manager')>()),
  recordSkillAttemptsWithHelp,
}))
vi.mock('@/lib/auth/withAuth', () => ({ withAuth: (handler: unknown) => handler }))
vi.mock('@/lib/viewer', () => ({ getUserId: async () => 'adult' }))
vi.mock('@/lib/classroom', () => ({ canPerformAction: async () => true }))
vi.mock('@/lib/classroom/socket-emitter', () => ({ emitSessionStartedToPlayer: vi.fn() }))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})

const arithmetic = arithmeticKind as unknown as AnyPartKind
const readAbacus = readAbacusKind as unknown as AnyPartKind

conformanceSuite(arithmetic, arithmeticFixtures, recordSkillAttemptsWithHelp)
conformanceSuite(readAbacus, readAbacusFixtures, recordSkillAttemptsWithHelp)

describe('the suite can fail (mutation tests)', () => {
  it("a kind whose applyTry ignores a do-over's redemption fails it", async () => {
    const mutated: AnyPartKind = {
      ...arithmetic,
      applyTry: (content, state, tries, t) =>
        t.kind === 'do_over' ? state : arithmetic.applyTry(content, state, tries, t),
    }
    const failed = await failingChecks(mutated, arithmeticFixtures, recordSkillAttemptsWithHelp)
    expect(failed).toContain(
      'a do-over of a wrong item in the part counts and redeems it (applyTry)'
    )
  }, 60_000)

  it('a do-over after divulging is practice-only whatever the kind says (A17)', async () => {
    // Arithmetic made to accept the do-overs it refuses: the recorder still
    // gives them no credit, so the kind passes as a practice-only kind
    const accepting: AnyPartKind = {
      ...arithmetic,
      acceptsDoOver: (content, state, tries, itemId) =>
        tries.some((t) => t.itemId === itemId) ||
        arithmetic.acceptsDoOver(content, state, tries, itemId),
      whyNotDoOver: undefined,
    }
    expect(
      await failingChecks(
        accepting,
        { ...arithmeticFixtures, doOverAfterDivulged: 'practice_only' },
        recordSkillAttemptsWithHelp
      )
    ).toEqual([])
    // Declared refused, it fails: the suite holds a kind to its declaration
    expect(
      await failingChecks(accepting, arithmeticFixtures, recordSkillAttemptsWithHelp)
    ).not.toEqual([])
  }, 60_000)

  it('the kinds as they are fail nothing (the mutation is what fails)', async () => {
    expect(
      await failingChecks(arithmetic, arithmeticFixtures, recordSkillAttemptsWithHelp)
    ).toEqual([])
  }, 60_000)
})
