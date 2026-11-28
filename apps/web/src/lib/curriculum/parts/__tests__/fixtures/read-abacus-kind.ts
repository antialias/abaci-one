/**
 * A stub second kind, "read the abacus" (plan of record §1.3): the proof that
 * a kind can be written against the contract alone. It imports the
 * contract, and from the shared cursor only its rule for when an answer is
 * shown (`answerShownWith`); `stub-kind.test.ts` checks that, and tsc checks
 * that it satisfies `PartKind`.
 */

import { answerShownWith } from '../../cursor/retry-rounds'
import type { KindTry, PartKind, Presentation } from '../../kind'

export interface ReadAbacusItem {
  itemId: string
  beadState: number[]
  expectedValue: number
  skillsRequired: string[]
}

export interface ReadAbacusPart {
  kind: 'read_abacus'
  partNumber: number
  content: { items: ReadAbacusItem[] }
}

type Content = ReadAbacusPart['content']
type State = { index: number }

/** Its one presentation (§5.2), its own mastery mode: recorded, consulted by nothing */
export const readAbacusStatic: Presentation<ReadAbacusPart> = {
  id: 'static',
  label: 'Read the abacus',
  emoji: '👀',
  masteryMode: 'read_abacus',
  axes: { layer: 'read_abacus', modality: 'visual', abacusAvailable: false, input: 'keypad' },
  needsPhysicalAbacus: () => false,
  autoPause: true,
}

export const readAbacusKind: PartKind<Content, State, ReadAbacusItem, ReadAbacusPart> = {
  id: 'read_abacus',
  presentations: new Map([[readAbacusStatic.id, readAbacusStatic]]),
  contentOf: (part) => part.content,
  isPlayable: (content) => content.items.length > 0,
  items: (content) => content.items.map((i) => ({ itemId: i.itemId })),
  itemOf: (content, itemId) => content.items.find((i) => i.itemId === itemId) ?? null,
  initialState: () => ({ index: 0 }),
  expectedItem: (content, state) => content.items[state.index] ?? null,
  // No retry rounds: a wrong first try shows the answer
  answerShown: answerShownWith(0),
  acceptsDoOver: (content, state, tries, itemId) =>
    content.items.slice(0, state.index).some((i) => i.itemId === itemId) &&
    tries.some((t: KindTry) => t.itemId === itemId),
  applyTry: (_content, state, _tries, t) =>
    t.kind === 'do_over' ? state : { index: state.index + 1 },
  applyTryAside: (_content, state) => state,
  isDone: (content, state) => state.index >= content.items.length,
  progress: (content, state) => ({ done: state.index, total: content.items.length }),
  // One try per item, no retry rounds: a wrong try shows the answer
  roundsRemaining: () => 0,
  judge: (content, itemId, answer) =>
    content.items.find((i) => i.itemId === itemId)?.expectedValue === answer,
  // Its snapshot lives in the payload once (practice-kinds plan §3.1)
  evidenceOf: (_part, t) => {
    const item = t.payload.item as ReadAbacusItem | undefined
    return item ? { skills: item.skillsRequired, presentation: 'static' } : null
  },
  describe: (_part, t) => {
    const item = t.payload.item as ReadAbacusItem | undefined
    return item ? `read the abacus: ${item.expectedValue}` : 'read the abacus'
  },
  payloadOf: (row) => row.payload ?? { kind: 'read_abacus' },
  presentationOf: () => readAbacusStatic,
}
