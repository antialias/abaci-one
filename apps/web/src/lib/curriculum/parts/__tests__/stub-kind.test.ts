/**
 * Phase 2 acceptance: a stub kind compiles against the contract with no
 * structural import of slots, and structure treats a kind it does not know
 * safely.
 */

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AnyPartKind, KindTry } from '../kind'
import { findPartKind, isPartPlayable, plannedItemCount } from '../registry'
import { type ReadAbacusPart, readAbacusKind } from './fixtures/read-abacus-kind'

const read = (rel: string) => readFileSync(path.join(__dirname, rel), 'utf8')
const importsOf = (src: string) =>
  [...src.matchAll(/^import\s[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1])

/** The arithmetic vocabulary structure must not know. */
const SLOT_WORDS = /slot|retryState|currentSlotIndex|ProblemSlot|GeneratedProblem|SessionPart\b/

/**
 * The shared cursor's list (practice-kinds §6.5, K3): `SLOT_WORDS` without
 * `slot`, whose words name the stored encoding there (`slotIndex`,
 * `redeemedSlots`, documented as such), plus the first kind's own words.
 */
const CURSOR_WORDS =
  /retryState|currentSlotIndex|ProblemSlot|GeneratedProblem|SessionPart\b|[pP]roblem|arithmetic/

const filesIn = (rel: string) =>
  readdirSync(path.join(__dirname, rel))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => `${rel}/${f}`)

const part: ReadAbacusPart = {
  kind: 'read_abacus',
  partNumber: 4,
  content: {
    items: [
      { itemId: 'a', beadState: [1, 0], expectedValue: 5, skillsRequired: [] },
      { itemId: 'b', beadState: [0, 2], expectedValue: 2, skillsRequired: [] },
    ],
  },
}

const tryOf = (itemId: string, isCorrect: boolean, kind: KindTry['kind'] = 'first'): KindTry => ({
  itemId,
  kind,
  round: 0,
  practiceOnly: false,
  isCorrect,
})

describe('a stub kind against the contract', () => {
  it("imports only the contract, which names no slot, and the shared cursor's answer-shown rule", () => {
    const stub = read('fixtures/read-abacus-kind.ts')
    expect(importsOf(stub)).toEqual(['../../cursor/retry-rounds', '../../kind'])
    // From the cursor, its rule for when an answer is shown (amendment A17) and nothing else
    expect(stub).toMatch(/^import \{ answerShownWith \} from '\.\.\/\.\.\/cursor\/retry-rounds'$/m)
    const contract = read('../kind.ts')
    expect(contract).not.toMatch(SLOT_WORDS)
    // Type-only: the try kind and, from K1a (practice-kinds plan §1.3), the
    // envelope's types; the stored row is named `StoredTry`, not by its shape
    expect(importsOf(contract)).toEqual(['@/db/schema/session-plans'])
    expect(contract).toMatch(
      /^import type \{\s*StoredTry,\s*TryEvidence,\s*TryKind,\s*TryOutcome,\s*TryPayload,\s*\} from '@\/db\/schema\/session-plans'$/m
    )
  })

  it('is assignable to the registry type and plays through by the contract alone', () => {
    const kind: AnyPartKind = readAbacusKind as unknown as AnyPartKind
    const content = kind.contentOf(part)
    expect(kind.isPlayable(content)).toBe(true)

    let state = kind.initialState(content)
    const tries: KindTry[] = []
    const answers: [string, number][] = [
      ['a', 5],
      ['b', 3],
    ]
    for (const [itemId, answer] of answers) {
      expect(kind.expectedItem(content, state)).toMatchObject({ itemId })
      const t = tryOf(itemId, kind.judge(content, itemId, answer))
      state = kind.applyTry(content, state, tries, t)
      tries.push(t)
    }
    expect(tries.map((t) => t.isCorrect)).toEqual([true, false])
    expect(kind.isDone(content, state)).toBe(true)
    expect(kind.expectedItem(content, state)).toBeNull()
    expect(kind.progress(content, state, tries)).toEqual({ done: 2, total: 2 })
    expect(kind.acceptsDoOver(content, state, tries, 'b')).toBe(true)
    expect(kind.acceptsDoOver(content, state, tries, 'zzz')).toBe(false)
    // K3's widening: items, itemOf, roundsRemaining, the presentation
    expect(kind.items(content)).toEqual([{ itemId: 'a' }, { itemId: 'b' }])
    expect(kind.itemOf(content, 'b')).toMatchObject({ expectedValue: 2 })
    expect(kind.itemOf(content, 'zzz')).toBeNull()
    expect(kind.roundsRemaining(content, state, 'b')).toBe(0)
    expect(kind.presentationOf(part)).toMatchObject({ id: 'static', masteryMode: 'read_abacus' })
    expect([...kind.presentations.keys()]).toEqual(['static'])
  })

  it('the shared cursor and the presentation index name no kind (K3)', () => {
    const cursorFiles = filesIn('../cursor')
    expect(cursorFiles).toEqual(['../cursor/retry-rounds.ts'])
    for (const file of cursorFiles) {
      const src = read(file)
      expect(src, file).not.toMatch(CURSOR_WORDS)
      expect(importsOf(src), file).toEqual(['../kind'])
    }
    for (const file of ['../presentations.ts', '../browser-kind.ts']) {
      const src = read(file)
      expect(src, file).not.toMatch(SLOT_WORDS)
      expect(src, file).not.toMatch(/arithmetic/)
    }
    expect(importsOf(read('../presentations.ts'))).toEqual(['./kind', './registry'])
    expect(importsOf(read('../browser-kind.ts'))).toEqual([])
  })

  it('a kind this image does not know: no kind, not abandoned, no planned items', () => {
    expect(findPartKind(part)).toBeUndefined()
    expect(isPartPlayable(part)).toBe(true)
    expect(plannedItemCount(part)).toBe(0)
  })
})
