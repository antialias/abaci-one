import type { DistancePair, EqualityFact, Citation } from './facts'
import { distancePairKey, distancePairsEqual } from './facts'

// ── Union-Find internals ──
// The UF is a derived cache over a store's facts. It's encapsulated here
// via a WeakMap — callers never see or interact with it directly.

interface UFNode {
  parent: string
  rank: number
  /** The fact ID that caused this node to merge with its parent (null for roots) */
  mergeFact: number | null
}

interface UnionFind {
  nodes: Map<string, UFNode>
}

/** Module-private: each FactStore has an associated UF, invisible to callers. */
const ufMap = new WeakMap<FactStore, UnionFind>()

function getUf(store: FactStore): UnionFind {
  const uf = ufMap.get(store)
  if (!uf) throw new Error('FactStore has no associated union-find — was it created via createFactStore()?')
  return uf
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
}

export function createFactStore(): FactStore {
  const store: FactStore = { facts: [], nextId: 1 }
  ufMap.set(store, { nodes: new Map() })
  return store
}

/**
 * Add an equality fact and run incremental C.N.1 transitivity via union-find merge.
 * Mutates the store in place and returns the newly created facts.
 */
export function addFact(
  store: FactStore,
  left: DistancePair,
  right: DistancePair,
  citation: Citation,
  statement: string,
  justification: string,
  atStep: number,
): EqualityFact[] {
  const uf = getUf(store)
  const keyL = distancePairKey(left)
  const keyR = distancePairKey(right)

  // Don't add duplicate facts
  if (ufConnected(uf, keyL, keyR)) {
    return []
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

  store.facts.push(fact)
  store.nextId++
  ufUnion(uf, keyL, keyR, fact.id)

  return [fact]
}

/** Are these two distances known-equal? */
export function queryEquality(
  store: FactStore,
  a: DistancePair,
  b: DistancePair,
): boolean {
  if (distancePairsEqual(a, b)) return true
  const uf = getUf(store)
  const keyA = distancePairKey(a)
  const keyB = distancePairKey(b)
  // If either key hasn't been registered, they can't be equal
  if (!uf.nodes.has(keyA) || !uf.nodes.has(keyB)) return false
  return ufConnected(uf, keyA, keyB)
}

/**
 * Create a fresh FactStore and replay the given facts via addFact().
 * This rebuilds the union-find from scratch — necessary because the
 * WeakMap-encapsulated UF can't be cloned.
 */
export function rebuildFactStore(facts: EqualityFact[]): FactStore {
  const store = createFactStore()
  for (const fact of facts) {
    addFact(store, fact.left, fact.right, fact.citation,
            fact.statement, fact.justification, fact.atStep)
  }
  return store
}

/** All distances known-equal to this one */
export function getEqualDistances(store: FactStore, dp: DistancePair): DistancePair[] {
  const uf = getUf(store)
  const key = distancePairKey(dp)
  if (!uf.nodes.has(key)) return [dp]

  const setKeys = ufGetSet(uf, key)
  return setKeys.map(k => {
    const [a, b] = k.split('|')
    return { a, b }
  })
}
