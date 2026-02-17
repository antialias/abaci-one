import { describe, it, expect } from 'vitest'
import { validateStep } from '../propositions/validation'
import { initializeGiven, addCircle, addSegment, addPoint } from '../engine/constructionState'
import type {
  ConstructionElement,
  ConstructionState,
  ExpectedAction,
  IntersectionCandidate,
} from '../types'
import { BYRNE } from '../types'

function givenABC(): ConstructionState {
  const given: ConstructionElement[] = [
    { kind: 'point', id: 'pt-A', x: 0, y: 0, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 2, y: 0, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: 1, y: 1.73, label: 'C', color: BYRNE.given, origin: 'given' },
  ]
  return initializeGiven(given)
}

describe('validateStep with ElementSelectors', () => {
  describe('intersection with circle selector', () => {
    it('accepts a candidate matching the resolved circle', () => {
      let state = givenABC()
      const cir = addCircle(state, 'pt-A', 'pt-B')
      state = cir.state
      const seg = addSegment(state, 'pt-A', 'pt-C')
      state = seg.state

      // Add an intersection point
      const pt = addPoint(state, 1, 1, 'intersection')
      state = pt.state

      const expected: ExpectedAction = {
        type: 'intersection',
        ofA: { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-B' },
        ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-C' },
      }

      const candidate: IntersectionCandidate = {
        x: 1, y: 1,
        ofA: cir.circle.id,
        ofB: seg.segment.id,
        which: 0,
      }

      expect(validateStep(expected, state, pt.point, candidate)).toBe(true)
    })

    it('accepts candidate with reversed ofA/ofB order', () => {
      let state = givenABC()
      const cir = addCircle(state, 'pt-A', 'pt-B')
      state = cir.state
      const seg = addSegment(state, 'pt-A', 'pt-C')
      state = seg.state

      const pt = addPoint(state, 1, 1, 'intersection')
      state = pt.state

      const expected: ExpectedAction = {
        type: 'intersection',
        ofA: { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-B' },
        ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-C' },
      }

      // Candidate has them swapped — should still match
      const candidate: IntersectionCandidate = {
        x: 1, y: 1,
        ofA: seg.segment.id,
        ofB: cir.circle.id,
        which: 0,
      }

      expect(validateStep(expected, state, pt.point, candidate)).toBe(true)
    })

    it('rejects a candidate from the wrong circle', () => {
      let state = givenABC()
      const cir1 = addCircle(state, 'pt-A', 'pt-B')
      state = cir1.state
      const cir2 = addCircle(state, 'pt-B', 'pt-A')
      state = cir2.state
      const seg = addSegment(state, 'pt-A', 'pt-C')
      state = seg.state

      const pt = addPoint(state, 1, 1, 'intersection')
      state = pt.state

      const expected: ExpectedAction = {
        type: 'intersection',
        ofA: { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-B' },
        ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-C' },
      }

      // Candidate is from circle 2 (wrong)
      const candidate: IntersectionCandidate = {
        x: 1, y: 1,
        ofA: cir2.circle.id,
        ofB: seg.segment.id,
        which: 0,
      }

      expect(validateStep(expected, state, pt.point, candidate)).toBe(false)
    })
  })

  describe('intersection without ofA/ofB (any intersection)', () => {
    it('accepts any intersection point', () => {
      let state = givenABC()
      const pt = addPoint(state, 1, 1, 'intersection')
      state = pt.state

      const expected: ExpectedAction = { type: 'intersection', label: 'C' }

      expect(validateStep(expected, state, pt.point)).toBe(true)
    })
  })

  describe('intersection with unresolvable selector', () => {
    it('rejects when a selector cannot be resolved', () => {
      let state = givenABC()
      const pt = addPoint(state, 1, 1, 'intersection')
      state = pt.state

      // No circle exists with this definition
      const expected: ExpectedAction = {
        type: 'intersection',
        ofA: { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-C' },
        ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-B' },
      }

      const candidate: IntersectionCandidate = {
        x: 1, y: 1, ofA: 'cir-1', ofB: 'seg-1', which: 0,
      }

      expect(validateStep(expected, state, pt.point, candidate)).toBe(false)
    })
  })

  describe('intersection edge cases', () => {
    it('rejects when no candidate is provided but selectors are specified', () => {
      let state = givenABC()
      const cir = addCircle(state, 'pt-A', 'pt-B')
      state = cir.state
      const seg = addSegment(state, 'pt-A', 'pt-C')
      state = seg.state
      const pt = addPoint(state, 1, 1, 'intersection')
      state = pt.state

      const expected: ExpectedAction = {
        type: 'intersection',
        ofA: { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-B' },
        ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-C' },
      }

      // No candidate provided — should reject
      expect(validateStep(expected, state, pt.point)).toBe(false)
    })

    it('rejects non-intersection point for intersection expected', () => {
      let state = givenABC()
      // A point with origin 'given', not 'intersection'
      const given = state.elements.find(e => e.kind === 'point' && e.id === 'pt-A')!

      const expected: ExpectedAction = { type: 'intersection' }
      expect(validateStep(expected, state, given)).toBe(false)
    })

    it('rejects a circle element for intersection expected', () => {
      let state = givenABC()
      const cir = addCircle(state, 'pt-A', 'pt-B')
      state = cir.state

      const expected: ExpectedAction = { type: 'intersection' }
      expect(validateStep(expected, state, cir.circle)).toBe(false)
    })

    it('accepts intersection with string selectors (legacy format)', () => {
      let state = givenABC()
      const cir = addCircle(state, 'pt-A', 'pt-B')
      state = cir.state
      const seg = addSegment(state, 'pt-A', 'pt-C')
      state = seg.state
      const pt = addPoint(state, 1, 1, 'intersection')
      state = pt.state

      // String selectors resolve as-is
      const expected: ExpectedAction = {
        type: 'intersection',
        ofA: cir.circle.id,
        ofB: seg.segment.id,
      }

      const candidate: IntersectionCandidate = {
        x: 1, y: 1,
        ofA: cir.circle.id,
        ofB: seg.segment.id,
        which: 0,
      }

      expect(validateStep(expected, state, pt.point, candidate)).toBe(true)
    })
  })

  describe('type mismatches', () => {
    it('rejects compass element for straightedge expected', () => {
      let state = givenABC()
      const cir = addCircle(state, 'pt-A', 'pt-B')
      state = cir.state

      const expected: ExpectedAction = {
        type: 'straightedge', fromId: 'pt-A', toId: 'pt-B',
      }

      expect(validateStep(expected, state, cir.circle)).toBe(false)
    })

    it('rejects segment element for compass expected', () => {
      let state = givenABC()
      const seg = addSegment(state, 'pt-A', 'pt-B')
      state = seg.state

      const expected: ExpectedAction = {
        type: 'compass', centerId: 'pt-A', radiusPointId: 'pt-B',
      }

      expect(validateStep(expected, state, seg.segment)).toBe(false)
    })

    it('returns false for macro expected (validated externally)', () => {
      let state = givenABC()
      const seg = addSegment(state, 'pt-A', 'pt-B')
      state = seg.state

      const expected: ExpectedAction = {
        type: 'macro', propId: 1, inputPointIds: ['pt-A', 'pt-B'],
      }

      expect(validateStep(expected, state, seg.segment)).toBe(false)
    })

    it('rejects compass with wrong center', () => {
      let state = givenABC()
      const cir = addCircle(state, 'pt-A', 'pt-B')
      state = cir.state

      const expected: ExpectedAction = {
        type: 'compass', centerId: 'pt-B', radiusPointId: 'pt-A',
      }

      expect(validateStep(expected, state, cir.circle)).toBe(false)
    })
  })

  describe('compass and straightedge (unchanged behavior)', () => {
    it('validates compass step', () => {
      let state = givenABC()
      const cir = addCircle(state, 'pt-A', 'pt-B')
      state = cir.state

      const expected: ExpectedAction = {
        type: 'compass', centerId: 'pt-A', radiusPointId: 'pt-B',
      }

      expect(validateStep(expected, state, cir.circle)).toBe(true)
    })

    it('validates straightedge step', () => {
      let state = givenABC()
      const seg = addSegment(state, 'pt-A', 'pt-B')
      state = seg.state

      const expected: ExpectedAction = {
        type: 'straightedge', fromId: 'pt-A', toId: 'pt-B',
      }

      expect(validateStep(expected, state, seg.segment)).toBe(true)
    })

    it('validates straightedge with reversed endpoints', () => {
      let state = givenABC()
      const seg = addSegment(state, 'pt-B', 'pt-A')
      state = seg.state

      const expected: ExpectedAction = {
        type: 'straightedge', fromId: 'pt-A', toId: 'pt-B',
      }

      expect(validateStep(expected, state, seg.segment)).toBe(true)
    })
  })
})
