import { describe, it, expect } from 'vitest'
import {
  initializeGiven,
  addPoint,
  addCircle,
  addSegment,
  getPoint,
  getAllCircles,
  getAllSegments,
  getAllPoints,
} from '../engine/constructionState'
import { createFactStore, addFact, queryEquality, rebuildFactStore } from '../engine/factStore'
import { distancePair } from '../engine/facts'
import type { ConstructionState, IntersectionCandidate } from '../types'
import type { ProofFact } from '../engine/facts'

// ── Helpers ──

/** Mirror of the captureSnapshot function in EuclidCanvas.tsx */
function captureSnapshot(
  construction: ConstructionState,
  candidates: IntersectionCandidate[],
  proofFacts: ProofFact[]
) {
  return { construction, candidates, proofFacts }
}

/** Build a minimal Prop I.1 starting state: two given points A, B */
function givenAB(): ConstructionState {
  return initializeGiven([
    { kind: 'point', id: 'pt-A', x: 0, y: 0, label: 'A', color: '#1A1A2E', origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 3, y: 0, label: 'B', color: '#1A1A2E', origin: 'given' },
  ])
}

/** Build a given state with segment AB */
function givenABWithSegment(): ConstructionState {
  return initializeGiven([
    { kind: 'point', id: 'pt-A', x: 0, y: 0, label: 'A', color: '#1A1A2E', origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 3, y: 0, label: 'B', color: '#1A1A2E', origin: 'given' },
    {
      kind: 'segment',
      id: 'seg-AB',
      fromId: 'pt-A',
      toId: 'pt-B',
      color: '#1A1A2E',
      origin: 'given',
    },
  ])
}

// ── Tests ──

describe('snapshot system', () => {
  describe('construction state immutability', () => {
    it('addPoint returns a new state object, leaving original unchanged', () => {
      const original = givenAB()
      const originalElements = original.elements
      const originalLength = original.elements.length

      const result = addPoint(original, 1, 2, 'intersection')
      expect(result.state).not.toBe(original)
      expect(result.state.elements).not.toBe(original.elements)
      // Original is unchanged
      expect(original.elements.length).toBe(originalLength)
      expect(original.elements).toBe(originalElements)
      // New state has the added point
      expect(result.state.elements.length).toBe(originalLength + 1)
    })

    it('addCircle returns a new state object, leaving original unchanged', () => {
      const original = givenAB()
      const originalLength = original.elements.length

      const result = addCircle(original, 'pt-A', 'pt-B')
      expect(result.state).not.toBe(original)
      expect(original.elements.length).toBe(originalLength)
      expect(result.state.elements.length).toBe(originalLength + 1)
    })

    it('addSegment returns a new state object, leaving original unchanged', () => {
      const original = givenAB()
      const originalLength = original.elements.length

      const result = addSegment(original, 'pt-A', 'pt-B')
      expect(result.state).not.toBe(original)
      expect(original.elements.length).toBe(originalLength)
      expect(result.state.elements.length).toBe(originalLength + 1)
    })

    it('multiple mutations create independent states', () => {
      const s0 = givenAB()
      const { state: s1 } = addCircle(s0, 'pt-A', 'pt-B')
      const { state: s2 } = addCircle(s1, 'pt-B', 'pt-A')
      const { state: s3 } = addPoint(s2, 1.5, 2.6, 'intersection', 'C')

      // All states are distinct objects
      expect(s0).not.toBe(s1)
      expect(s1).not.toBe(s2)
      expect(s2).not.toBe(s3)

      // Element counts reflect each step
      expect(s0.elements.length).toBe(2) // A, B
      expect(s1.elements.length).toBe(3) // A, B, circle1
      expect(s2.elements.length).toBe(4) // A, B, circle1, circle2
      expect(s3.elements.length).toBe(5) // A, B, circle1, circle2, C
    })
  })

  describe('captureSnapshot independence', () => {
    it('snapshot construction is not affected by later addCircle', () => {
      const state0 = givenAB()
      const snap = captureSnapshot(state0, [], [])

      // Mutate construction
      const { state: state1 } = addCircle(state0, 'pt-A', 'pt-B')

      // Snapshot still has old state
      expect(snap.construction.elements.length).toBe(2)
      expect(state1.elements.length).toBe(3)
      expect(snap.construction).toBe(state0)
    })

    it('snapshot candidates are not affected by later array replacement', () => {
      const candidates: IntersectionCandidate[] = [
        { x: 1.5, y: 2.6, ofA: 'cir-1', ofB: 'cir-2', which: 0 },
      ]
      const snap = captureSnapshot(givenAB(), candidates, [])

      // Replace candidates array (as EuclidCanvas does)
      const newCandidates = [
        ...candidates,
        { x: 1.5, y: -2.6, ofA: 'cir-1', ofB: 'cir-2', which: 1 },
      ]

      // Snapshot still has old array
      expect(snap.candidates).toBe(candidates)
      expect(snap.candidates.length).toBe(1)
      expect(newCandidates.length).toBe(2)
    })

    it('snapshot proofFacts are not affected by later array replacement', () => {
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const newFacts = addFact(
        store,
        dpAB,
        dpCD,
        { type: 'def15', circleId: 'cir-1' },
        'AB = CD',
        'test',
        0
      )

      const facts0: ProofFact[] = [...newFacts]
      const snap = captureSnapshot(givenAB(), [], facts0)

      // Replace proofFacts array (as proofFactsRef.current = [...old, ...new])
      const dpEF = distancePair('pt-E', 'pt-F')
      const moreFacts = addFact(
        store,
        dpCD,
        dpEF,
        { type: 'def15', circleId: 'cir-2' },
        'CD = EF',
        'test',
        1
      )
      const facts1 = [...facts0, ...moreFacts]

      // Snapshot still has old array
      expect(snap.proofFacts).toBe(facts0)
      expect(snap.proofFacts.length).toBe(1)
      expect(facts1.length).toBe(2)
    })

    it('multiple snapshots are independent from each other', () => {
      const s0 = givenAB()
      const snap0 = captureSnapshot(s0, [], [])

      const { state: s1 } = addCircle(s0, 'pt-A', 'pt-B')
      const candidates1: IntersectionCandidate[] = [
        { x: 1.5, y: 2.6, ofA: 'cir-1', ofB: 'cir-2', which: 0 },
      ]
      const snap1 = captureSnapshot(s1, candidates1, [])

      const { state: s2 } = addCircle(s1, 'pt-B', 'pt-A')
      const snap2 = captureSnapshot(s2, candidates1, [])

      // All snapshots have correct element counts
      expect(snap0.construction.elements.length).toBe(2)
      expect(snap1.construction.elements.length).toBe(3)
      expect(snap2.construction.elements.length).toBe(4)
    })
  })

  describe('snapshot stack operations', () => {
    it('initial stack has one snapshot (before step 0)', () => {
      const initialState = givenABWithSegment()
      const stack = [captureSnapshot(initialState, [], [])]

      expect(stack).toHaveLength(1)
      expect(stack[0].construction).toBe(initialState)
      expect(stack[0].proofFacts).toEqual([])
    })

    it('pushing snapshot on step completion grows the stack', () => {
      const s0 = givenABWithSegment()
      const stack = [captureSnapshot(s0, [], [])]

      // Step 0 completes: add circle A→B
      const { state: s1 } = addCircle(s0, 'pt-A', 'pt-B')
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const facts1 = addFact(
        store,
        dpAB,
        dpCD,
        { type: 'def15', circleId: 'cir-1' },
        'AB = CD',
        'test',
        0
      )
      const proofFacts1 = [...facts1]

      stack.push(captureSnapshot(s1, [], proofFacts1))

      expect(stack).toHaveLength(2)
      expect(stack[1].construction.elements.length).toBe(s0.elements.length + 1)
      expect(stack[1].proofFacts).toHaveLength(1)
    })

    it('truncating to targetStep removes snapshots after it', () => {
      const s0 = givenABWithSegment()
      const stack = [captureSnapshot(s0, [], [])]

      // Simulate 3 completed steps
      const { state: s1 } = addCircle(s0, 'pt-A', 'pt-B')
      stack.push(captureSnapshot(s1, [], []))

      const { state: s2 } = addCircle(s1, 'pt-B', 'pt-A')
      stack.push(captureSnapshot(s2, [], []))

      const { state: s3 } = addPoint(s2, 1.5, 2.6, 'intersection', 'C')
      stack.push(captureSnapshot(s3, [], []))

      expect(stack).toHaveLength(4)

      // Rewind to step 1 → truncate to [0..1]
      const targetStep = 1
      const truncated = stack.slice(0, targetStep + 1)

      expect(truncated).toHaveLength(2)
      expect(truncated[0].construction.elements.length).toBe(s0.elements.length)
      expect(truncated[1].construction.elements.length).toBe(s1.elements.length)
    })

    it('truncating to step 0 leaves only the initial snapshot', () => {
      const s0 = givenABWithSegment()
      const stack = [captureSnapshot(s0, [], [])]

      const { state: s1 } = addCircle(s0, 'pt-A', 'pt-B')
      stack.push(captureSnapshot(s1, [], []))

      const { state: s2 } = addCircle(s1, 'pt-B', 'pt-A')
      stack.push(captureSnapshot(s2, [], []))

      const truncated = stack.slice(0, 1) // [0..0]
      expect(truncated).toHaveLength(1)
      expect(truncated[0].construction).toBe(s0)
    })
  })

  describe('rewind to step 0', () => {
    it('restores initial construction (given elements only)', () => {
      const initial = givenABWithSegment()
      const snap0 = captureSnapshot(initial, [], [])

      // Simulate construction
      const { state: s1 } = addCircle(initial, 'pt-A', 'pt-B')
      const { state: s2 } = addCircle(s1, 'pt-B', 'pt-A')

      // Rewind to step 0
      const restored = snap0.construction
      expect(restored).toBe(initial)
      expect(getAllCircles(restored)).toHaveLength(0)
      expect(getAllPoints(restored)).toHaveLength(2) // A, B only
      expect(getAllSegments(restored)).toHaveLength(1) // Given AB
    })

    it('rebuilds empty fact store', () => {
      const rebuilt = rebuildFactStore([])
      expect(rebuilt.facts).toHaveLength(0)

      // No equalities should be known
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      expect(queryEquality(rebuilt, dpAB, dpCD)).toBe(false)
    })
  })

  describe('rewind from complete state', () => {
    it('facts accumulated through all steps can be truncated', () => {
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCA = distancePair('pt-C', 'pt-A')
      const dpCB = distancePair('pt-C', 'pt-B')

      // Step 0: AB = CA (from first circle)
      const f0 = addFact(
        store,
        dpAB,
        dpCA,
        { type: 'def15', circleId: 'cir-1' },
        'AB = CA',
        'test',
        0
      )
      const proofFacts0 = [...f0]

      // Step 1: AB = CB (from second circle)
      const f1 = addFact(
        store,
        dpAB,
        dpCB,
        { type: 'def15', circleId: 'cir-2' },
        'AB = CB',
        'test',
        1
      )
      const proofFacts1 = [...proofFacts0, ...f1]

      // Step 2 (conclusion): CA = CB (transitive — already known)
      // In the real code, conclusion facts are added at step = steps.length
      const proofFactsComplete = [...proofFacts1]

      // Rewind to step 1: use only facts from snapshot at step 1
      const rebuiltStep1 = rebuildFactStore(proofFacts0)
      expect(queryEquality(rebuiltStep1, dpAB, dpCA)).toBe(true)
      expect(queryEquality(rebuiltStep1, dpAB, dpCB)).toBe(false)

      // Rewind to step 2: use facts from snapshot at step 2
      const rebuiltStep2 = rebuildFactStore(proofFacts1)
      expect(queryEquality(rebuiltStep2, dpAB, dpCA)).toBe(true)
      expect(queryEquality(rebuiltStep2, dpAB, dpCB)).toBe(true)
      // Transitive: CA = CB
      expect(queryEquality(rebuiltStep2, dpCA, dpCB)).toBe(true)
    })

    it('conclusion facts are excluded from pre-completion snapshots', () => {
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCA = distancePair('pt-C', 'pt-A')

      addFact(store, dpAB, dpCA, { type: 'def15', circleId: 'cir-1' }, 'AB = CA', 'test', 0)

      // Snapshot taken before step 1 has only step-0 facts
      const snapshot = captureSnapshot(givenAB(), [], store.facts.slice())

      // Later, conclusion facts are added at step=5 (steps.length)
      const dpCB = distancePair('pt-C', 'pt-B')
      addFact(store, dpAB, dpCB, { type: 'prop', propId: 1 }, 'AB = CB', 'conclusion', 5)

      // Snapshot doesn't have the conclusion fact
      expect(snapshot.proofFacts).toHaveLength(1)
      expect(store.facts).toHaveLength(2)

      // Rebuilding from snapshot only has pre-conclusion knowledge
      const rebuilt = rebuildFactStore(snapshot.proofFacts)
      expect(queryEquality(rebuilt, dpAB, dpCB)).toBe(false)
    })
  })

  describe('fact store rebuild for rewind', () => {
    it('rebuild produces a fully functional store', () => {
      const original = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCA = distancePair('pt-C', 'pt-A')
      const dpCB = distancePair('pt-C', 'pt-B')

      addFact(original, dpAB, dpCA, { type: 'def15', circleId: 'cir-1' }, 'AB = CA', 'test', 0)
      addFact(original, dpAB, dpCB, { type: 'def15', circleId: 'cir-2' }, 'AB = CB', 'test', 1)

      const rebuilt = rebuildFactStore(original.facts)

      // Direct equalities
      expect(queryEquality(rebuilt, dpAB, dpCA)).toBe(true)
      expect(queryEquality(rebuilt, dpAB, dpCB)).toBe(true)
      // Transitive
      expect(queryEquality(rebuilt, dpCA, dpCB)).toBe(true)

      // Can add new facts to rebuilt store
      const dpDE = distancePair('pt-D', 'pt-E')
      const newFacts = addFact(
        rebuilt,
        dpCA,
        dpDE,
        { type: 'def15', circleId: 'cir-3' },
        'CA = DE',
        'test',
        2
      )
      expect(newFacts).toHaveLength(1)
      // Transitive through rebuilt store
      expect(queryEquality(rebuilt, dpAB, dpDE)).toBe(true)
    })

    it('rebuilt store rejects already-known equalities', () => {
      const original = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCA = distancePair('pt-C', 'pt-A')
      const dpCB = distancePair('pt-C', 'pt-B')

      addFact(original, dpAB, dpCA, { type: 'def15', circleId: 'cir-1' }, 'AB = CA', 'test', 0)
      addFact(original, dpAB, dpCB, { type: 'def15', circleId: 'cir-2' }, 'AB = CB', 'test', 1)

      const rebuilt = rebuildFactStore(original.facts)

      // CA = CB is transitively known — addFact should reject it
      const redundant = addFact(
        rebuilt,
        dpCA,
        dpCB,
        { type: 'cn1', via: dpAB },
        'CA = CB',
        'test',
        2
      )
      expect(redundant).toHaveLength(0)
    })
  })

  describe('multi-step simulation', () => {
    it('full I.1-style workflow with snapshots and rewind', () => {
      // Setup: two given points A, B with segment AB
      const s0 = givenABWithSegment()
      const store0 = createFactStore()
      const snapshots = [captureSnapshot(s0, [], [])]

      // Step 0: Draw circle centered at A through B
      const { state: s1 } = addCircle(s0, 'pt-A', 'pt-B')
      const facts0: ProofFact[] = []
      snapshots.push(captureSnapshot(s1, [], facts0))

      // Step 1: Draw circle centered at B through A
      const { state: s2 } = addCircle(s1, 'pt-B', 'pt-A')
      const facts1: ProofFact[] = []
      snapshots.push(captureSnapshot(s2, [], facts1))

      // Step 2: Mark intersection C
      const { state: s3 } = addPoint(s2, 1.5, 2.598, 'intersection', 'C')

      // Derive Def.15 facts
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpAC = distancePair('pt-A', 'pt-C')
      const dpBA = distancePair('pt-B', 'pt-A')
      const dpBC = distancePair('pt-B', 'pt-C')

      const store3 = createFactStore()
      const f1 = addFact(
        store3,
        dpAB,
        dpAC,
        { type: 'def15', circleId: 'cir-1' },
        'AB = AC',
        'C on circle(A,B)',
        2
      )
      const f2 = addFact(
        store3,
        dpBA,
        dpBC,
        { type: 'def15', circleId: 'cir-2' },
        'BA = BC',
        'C on circle(B,A)',
        2
      )
      const facts2 = [...f1, ...f2]
      snapshots.push(captureSnapshot(s3, [], facts2))

      expect(snapshots).toHaveLength(4)

      // Verify state at each snapshot
      expect(getAllCircles(snapshots[0].construction)).toHaveLength(0)
      expect(getAllCircles(snapshots[1].construction)).toHaveLength(1)
      expect(getAllCircles(snapshots[2].construction)).toHaveLength(2)
      expect(getPoint(snapshots[3].construction, 'pt-C')).toBeDefined()

      // Rewind to step 1 (after first circle, before second)
      const targetStep = 1
      const rewindSnap = snapshots[targetStep]
      const rewindedStack = snapshots.slice(0, targetStep + 1)

      expect(rewindedStack).toHaveLength(2)
      expect(getAllCircles(rewindSnap.construction)).toHaveLength(1)
      expect(getPoint(rewindSnap.construction, 'pt-C')).toBeUndefined()

      // Rebuild fact store from snapshot
      const rebuiltStore = rebuildFactStore(rewindSnap.proofFacts)
      expect(rebuiltStore.facts).toHaveLength(0)
      expect(queryEquality(rebuiltStore, dpAB, dpAC)).toBe(false)
    })

    it('rewind and redo: new construction after rewind produces valid snapshots', () => {
      const s0 = givenAB()
      const snapshots = [captureSnapshot(s0, [], [])]

      // Step 0: circle A→B
      const { state: s1 } = addCircle(s0, 'pt-A', 'pt-B')
      snapshots.push(captureSnapshot(s1, [], []))

      // Step 1: circle B→A
      const { state: s2 } = addCircle(s1, 'pt-B', 'pt-A')
      snapshots.push(captureSnapshot(s2, [], []))

      // Rewind to step 0 (one circle drawn)
      const truncated = snapshots.slice(0, 1 + 1)
      expect(truncated).toHaveLength(2)

      // Redo: draw a DIFFERENT circle (B→A first this time)
      const rewindState = truncated[1].construction
      const { state: s2Alt } = addCircle(rewindState, 'pt-B', 'pt-A')
      truncated.push(captureSnapshot(s2Alt, [], []))

      // Stack now has 3 entries with the alternate path
      expect(truncated).toHaveLength(3)
      expect(getAllCircles(truncated[2].construction)).toHaveLength(2)
    })

    it('multiple rapid rewinds are deterministic', () => {
      const s0 = givenAB()
      let stack = [captureSnapshot(s0, [], [])]

      // Build 5 steps
      let state = s0
      for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
          const result = addCircle(state, 'pt-A', 'pt-B')
          state = result.state
        } else {
          const result = addPoint(state, i * 0.5, i * 0.3, 'intersection')
          state = result.state
        }
        stack = [...stack, captureSnapshot(state, [], [])]
      }
      expect(stack).toHaveLength(6)

      // Rewind to step 3
      stack = stack.slice(0, 4)
      expect(stack).toHaveLength(4)

      // Rewind to step 1
      stack = stack.slice(0, 2)
      expect(stack).toHaveLength(2)

      // Rewind to step 0
      stack = stack.slice(0, 1)
      expect(stack).toHaveLength(1)
      expect(stack[0].construction).toBe(s0)

      // Verify original state is perfectly preserved
      expect(getAllPoints(stack[0].construction)).toHaveLength(2) // A, B only
      expect(getAllCircles(stack[0].construction)).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('snapshot with empty candidates array', () => {
      const snap = captureSnapshot(givenAB(), [], [])
      expect(snap.candidates).toEqual([])
    })

    it('snapshot preserves candidate details', () => {
      const candidates: IntersectionCandidate[] = [
        { x: 1.5, y: 2.598, ofA: 'cir-1', ofB: 'cir-2', which: 0 },
        { x: 1.5, y: -2.598, ofA: 'cir-1', ofB: 'cir-2', which: 1 },
      ]
      const snap = captureSnapshot(givenAB(), candidates, [])
      expect(snap.candidates).toHaveLength(2)
      expect(snap.candidates[0].x).toBeCloseTo(1.5)
      expect(snap.candidates[1].y).toBeCloseTo(-2.598)
    })

    it('rewind with proofFacts containing multiple steps gets correctly filtered', () => {
      const store = createFactStore()

      // Facts from step 0
      const f0 = addFact(
        store,
        distancePair('pt-A', 'pt-B'),
        distancePair('pt-A', 'pt-C'),
        { type: 'def15', circleId: 'cir-1' },
        'AB = AC',
        'test',
        0
      )

      // Facts from step 1
      const f1 = addFact(
        store,
        distancePair('pt-B', 'pt-A'),
        distancePair('pt-B', 'pt-C'),
        { type: 'def15', circleId: 'cir-2' },
        'BA = BC',
        'test',
        1
      )

      const allFacts = [...f0, ...f1]

      // Snapshot at step 1 boundary has only step 0 facts
      const factsAtStep1 = allFacts.filter((f) => f.atStep < 1)
      const rebuilt = rebuildFactStore(factsAtStep1)
      expect(rebuilt.facts).toHaveLength(1)
      expect(
        queryEquality(rebuilt, distancePair('pt-A', 'pt-B'), distancePair('pt-A', 'pt-C'))
      ).toBe(true)
      expect(
        queryEquality(rebuilt, distancePair('pt-B', 'pt-A'), distancePair('pt-B', 'pt-C'))
      ).toBe(false)
    })

    it('construction state nextLabelIndex and nextColorIndex are preserved in snapshot', () => {
      const s0 = givenAB()
      const { state: s1 } = addCircle(s0, 'pt-A', 'pt-B')
      const { state: s2 } = addPoint(s1, 1.5, 2.6, 'intersection', 'C')

      const snap = captureSnapshot(s2, [], [])
      expect(snap.construction.nextLabelIndex).toBe(s2.nextLabelIndex)
      expect(snap.construction.nextColorIndex).toBe(s2.nextColorIndex)

      // After rewind, these counters allow correct labeling
      const { point } = addPoint(snap.construction, 2.0, 1.0, 'intersection')
      expect(point.label).toBe('D') // nextLabelIndex should be past C
    })
  })
})
