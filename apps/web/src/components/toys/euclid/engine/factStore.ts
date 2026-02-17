import type { DistancePair, EqualityFact, Citation } from './facts'
import { distancePairKey, distancePairsEqual } from './facts'

// ── Union-Find internals ──

interface UFNode {
  parent: string
  rank: number
  /** The fact ID that caused this node to merge with its parent (null for roots) */
  mergeFact: number | null
}

interface UnionFind {
  nodes: Map<string, UFNode>
}

function ufEnsure(uf: UnionFind, key: string) {
  if (!uf.nodes.has(key)) {
    uf.nodes.set(key, { parent: key, rank: 0, mergeFact: null })
  }
}

function ufFind(uf: UnionFind, key: string): string {
  ufEnsure(uf, key)
  let node = uf.nodes.get(key)!
  // Path compression
  const path: string[] = []
  while (node.parent !== key) {
    path.push(key)
    key = node.parent
    node = uf.nodes.get(key)!
  }
  for (const p of path) {
    uf.nodes.get(p)!.parent = key
  }
  return key
}

function ufUnion(uf: UnionFind, a: string, b: string, factId: number): boolean {
  const rootA = ufFind(uf, a)
  const rootB = ufFind(uf, b)
  if (rootA === rootB) return false // already in same set

  const nodeA = uf.nodes.get(rootA)!
  const nodeB = uf.nodes.get(rootB)!

  if (nodeA.rank < nodeB.rank) {
    nodeA.parent = rootB
    nodeA.mergeFact = factId
  } else if (nodeA.rank > nodeB.rank) {
    nodeB.parent = rootA
    nodeB.mergeFact = factId
  } else {
    nodeB.parent = rootA
    nodeB.mergeFact = factId
    nodeA.rank += 1
  }
  return true
}

function ufConnected(uf: UnionFind, a: string, b: string): boolean {
  return ufFind(uf, a) === ufFind(uf, b)
}

/** Get all keys in the same set as the given key */
function ufGetSet(uf: UnionFind, key: string): string[] {
  const root = ufFind(uf, key)
  const result: string[] = []
  for (const [k] of uf.nodes) {
    if (ufFind(uf, k) === root) {
      result.push(k)
    }
  }
  return result
}

// ── FactStore ──

export interface FactStore {
  facts: EqualityFact[]
  nextId: number
  /** @internal */
  _uf: UnionFind
}

export function createFactStore(): FactStore {
  return {
    facts: [],
    nextId: 1,
    _uf: { nodes: new Map() },
  }
}

/** Add an equality fact and run incremental C.N.1 transitivity via union-find merge */
export function addFact(
  store: FactStore,
  left: DistancePair,
  right: DistancePair,
  citation: Citation,
  statement: string,
  justification: string,
  atStep: number,
): { store: FactStore; newFacts: EqualityFact[] } {
  const keyL = distancePairKey(left)
  const keyR = distancePairKey(right)

  // Don't add duplicate facts
  if (ufConnected(store._uf, keyL, keyR)) {
    return { store, newFacts: [] }
  }

  const fact: EqualityFact = {
    id: store.nextId,
    left,
    right,
    citation,
    statement,
    justification,
    atStep,
  }

  const newFacts: EqualityFact[] = [fact]
  const newStore: FactStore = {
    ...store,
    facts: [...store.facts, fact],
    nextId: store.nextId + 1,
    _uf: store._uf, // shared mutable — fine for our use case
  }

  ufUnion(newStore._uf, keyL, keyR, fact.id)

  return { store: newStore, newFacts }
}

/** Are these two distances known-equal? */
export function queryEquality(
  store: FactStore,
  a: DistancePair,
  b: DistancePair,
): boolean {
  if (distancePairsEqual(a, b)) return true
  const keyA = distancePairKey(a)
  const keyB = distancePairKey(b)
  // If either key hasn't been registered, they can't be equal
  if (!store._uf.nodes.has(keyA) || !store._uf.nodes.has(keyB)) return false
  return ufConnected(store._uf, keyA, keyB)
}

/** All distances known-equal to this one */
export function getEqualDistances(store: FactStore, dp: DistancePair): DistancePair[] {
  const key = distancePairKey(dp)
  if (!store._uf.nodes.has(key)) return [dp]

  const setKeys = ufGetSet(store._uf, key)
  return setKeys.map(k => {
    const [a, b] = k.split('|')
    return { a, b }
  })
}
