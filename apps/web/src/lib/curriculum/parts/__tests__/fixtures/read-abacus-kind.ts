/**
 * A stub second kind, "read the abacus" (plan of record §1.3): the proof that
 * a kind can be written against the contract alone. It imports only
 * `../../kind`; `stub-kind.test.ts` checks that, and tsc checks that it
 * satisfies `PartKind`.
 */

import type { KindTry, PartKind } from '../../kind'

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

export const readAbacusKind: PartKind<Content, State, ReadAbacusItem, ReadAbacusPart> = {
  id: 'read_abacus',
  contentOf: (part) => part.content,
  isPlayable: (content) => content.items.length > 0,
  initialState: () => ({ index: 0 }),
  expectedItem: (content, state) => content.items[state.index] ?? null,
  acceptsDoOver: (content, state, tries, itemId) =>
    content.items.slice(0, state.index).some((i) => i.itemId === itemId) &&
    tries.some((t: KindTry) => t.itemId === itemId),
  applyTry: (_content, state, _tries, t) =>
    t.kind === 'do_over' ? state : { index: state.index + 1 },
  isDone: (content, state) => state.index >= content.items.length,
  progress: (content, state) => ({ done: state.index, total: content.items.length }),
  judge: (content, itemId, answer) =>
    content.items.find((i) => i.itemId === itemId)?.expectedValue === answer,
  presentationOf: () => ({
    layer: 'read_abacus',
    modality: 'visual',
    abacusAvailable: false,
    input: 'keypad',
  }),
  bktMode: () => null,
}
