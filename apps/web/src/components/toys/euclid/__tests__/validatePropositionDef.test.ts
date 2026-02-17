import { describe, it, expect } from 'vitest'
import { validatePropositionDef } from '../engine/validatePropositionDef'
import { PROP_1 } from '../propositions/prop1'
import { PROP_2 } from '../propositions/prop2'
import { PROP_3 } from '../propositions/prop3'
import type { PropositionDef, ConstructionElement } from '../types'
import { BYRNE } from '../types'

function minimalGiven(...labels: string[]): ConstructionElement[] {
  return labels.map((label, i) => ({
    kind: 'point' as const,
    id: `pt-${label}`,
    x: i,
    y: 0,
    label,
    color: BYRNE.given,
    origin: 'given' as const,
  }))
}

describe('validatePropositionDef', () => {
  describe('existing propositions', () => {
    it('Prop I.1 has no validation errors', () => {
      const errors = validatePropositionDef(PROP_1)
      expect(errors).toEqual([])
    })

    it('Prop I.2 has no validation errors', () => {
      const errors = validatePropositionDef(PROP_2)
      expect(errors).toEqual([])
    })

    it('Prop I.3 has no validation errors', () => {
      const errors = validatePropositionDef(PROP_3)
      expect(errors).toEqual([])
    })
  })

  describe('catches typos in point IDs', () => {
    it('detects unknown centerId in compass step', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [{
          instruction: 'test',
          expected: { type: 'compass', centerId: 'pt-A', radiusPointId: 'pt-Z' },
          highlightIds: [],
          tool: 'compass',
        }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-Z')
      expect(errors[0].field).toBe('radiusPointId')
    })

    it('detects unknown fromId in straightedge step', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [{
          instruction: 'test',
          expected: { type: 'straightedge', fromId: 'pt-X', toId: 'pt-B' },
          highlightIds: [],
          tool: 'straightedge',
        }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-X')
      expect(errors[0].field).toBe('fromId')
    })

    it('detects unknown beyondId in intersection step', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [{
          instruction: 'test',
          expected: {
            type: 'intersection',
            beyondId: 'pt-Q',
            label: 'C',
          },
          highlightIds: [],
          tool: null,
        }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-Q')
      expect(errors[0].field).toBe('beyondId')
    })

    it('detects unknown point in ElementSelector (circle)', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [{
          instruction: 'test',
          expected: {
            type: 'intersection',
            ofA: { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-TYPO' },
            ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-B' },
          },
          highlightIds: [],
          tool: null,
        }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-TYPO')
      expect(errors[0].field).toBe('ofA')
    })

    it('detects unknown point in ElementSelector (segment)', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [{
          instruction: 'test',
          expected: {
            type: 'intersection',
            ofA: { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-B' },
            ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-NOPE' },
          },
          highlightIds: [],
          tool: null,
        }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-NOPE')
      expect(errors[0].field).toBe('ofB')
    })

    it('detects unknown inputPointIds in macro step', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [{
          instruction: 'test',
          expected: { type: 'macro', propId: 1, inputPointIds: ['pt-A', 'pt-MISSING'] },
          highlightIds: [],
          tool: 'macro',
        }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-MISSING')
      expect(errors[0].field).toBe('inputPointIds')
    })
  })

  describe('tracks points introduced by steps', () => {
    it('intersection label introduces a new point for later steps', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [
          {
            instruction: 'mark intersection',
            expected: { type: 'intersection', label: 'C' },
            highlightIds: [],
            tool: null,
          },
          {
            instruction: 'draw line',
            expected: { type: 'straightedge', fromId: 'pt-C', toId: 'pt-A' },
            highlightIds: [],
            tool: 'straightedge',
          },
        ],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toEqual([])
    })

    it('macro outputLabels introduce new points for later steps', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [
          {
            instruction: 'construct triangle',
            expected: { type: 'macro', propId: 1, inputPointIds: ['pt-A', 'pt-B'], outputLabels: { apex: 'D' } },
            highlightIds: [],
            tool: 'macro',
          },
          {
            instruction: 'draw circle',
            expected: { type: 'compass', centerId: 'pt-D', radiusPointId: 'pt-A' },
            highlightIds: [],
            tool: 'compass',
          },
        ],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toEqual([])
    })

    it('rejects reference to point introduced by a LATER step', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [
          {
            instruction: 'draw line to C (not yet created)',
            expected: { type: 'straightedge', fromId: 'pt-C', toId: 'pt-A' },
            highlightIds: [],
            tool: 'straightedge',
          },
          {
            instruction: 'mark intersection',
            expected: { type: 'intersection', label: 'C' },
            highlightIds: [],
            tool: null,
          },
        ],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].stepIndex).toBe(0)
      expect(errors[0].pointId).toBe('pt-C')
    })
  })

  describe('validates highlightIds', () => {
    it('detects unknown point in highlightIds', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [{
          instruction: 'test',
          expected: { type: 'compass', centerId: 'pt-A', radiusPointId: 'pt-B' },
          highlightIds: ['pt-A', 'pt-WRONG'],
          tool: 'compass',
        }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-WRONG')
      expect(errors[0].field).toBe('highlightIds')
    })
  })

  describe('validates resultSegments', () => {
    it('detects unknown point in resultSegments', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [],
        resultSegments: [{ fromId: 'pt-A', toId: 'pt-GHOST' }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-GHOST')
      expect(errors[0].field).toBe('resultSegments.toId')
    })
  })

  describe('validates givenElements internal references', () => {
    it('detects given segment referencing unknown point', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: [
          ...minimalGiven('A'),
          {
            kind: 'segment',
            id: 'seg-1',
            fromId: 'pt-A',
            toId: 'pt-NOPE',
            color: BYRNE.given,
            origin: 'given',
          },
        ] as ConstructionElement[],
        steps: [],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-NOPE')
      expect(errors[0].field).toBe('givenElements.segment.toId')
    })
  })

  describe('reports multiple errors', () => {
    it('collects all errors across steps', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A'),
        steps: [
          {
            instruction: 'step 0',
            expected: { type: 'compass', centerId: 'pt-A', radiusPointId: 'pt-X' },
            highlightIds: [],
            tool: 'compass',
          },
          {
            instruction: 'step 1',
            expected: { type: 'straightedge', fromId: 'pt-Y', toId: 'pt-Z' },
            highlightIds: [],
            tool: 'straightedge',
          },
        ],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(3)
      const ids = errors.map(e => e.pointId).sort()
      expect(ids).toEqual(['pt-X', 'pt-Y', 'pt-Z'])
    })

    it('reports errors from both expected and highlightIds in same step', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A'),
        steps: [{
          instruction: 'test',
          expected: { type: 'compass', centerId: 'pt-A', radiusPointId: 'pt-BAD1' },
          highlightIds: ['pt-BAD2'],
          tool: 'compass',
        }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(2)
      const ids = errors.map(e => e.pointId).sort()
      expect(ids).toEqual(['pt-BAD1', 'pt-BAD2'])
    })

    it('reports both fields when compass has two unknown points', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A'),
        steps: [{
          instruction: 'test',
          expected: { type: 'compass', centerId: 'pt-X', radiusPointId: 'pt-Y' },
          highlightIds: [],
          tool: 'compass',
        }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(2)
      expect(errors[0].field).toBe('centerId')
      expect(errors[1].field).toBe('radiusPointId')
    })
  })

  describe('intersection label edge cases', () => {
    it('intersection without label does not introduce a point', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [
          {
            instruction: 'mark intersection (no label)',
            expected: { type: 'intersection' },
            highlightIds: [],
            tool: null,
          },
          {
            instruction: 'try to use auto-generated point',
            expected: { type: 'straightedge', fromId: 'pt-C', toId: 'pt-A' },
            highlightIds: [],
            tool: 'straightedge',
          },
        ],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-C')
      expect(errors[0].stepIndex).toBe(1)
    })

    it('intersection beyondId cannot reference the label being created by that same step', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [{
          instruction: 'test',
          expected: {
            type: 'intersection',
            beyondId: 'pt-C',
            label: 'C',
          },
          highlightIds: [],
          tool: null,
        }],
      }
      // pt-C is introduced BY this step, so beyondId referencing it should fail
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-C')
      expect(errors[0].field).toBe('beyondId')
    })
  })

  describe('macro edge cases', () => {
    it('macro without outputLabels does not introduce points', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [
          {
            instruction: 'macro with no output labels',
            expected: { type: 'macro', propId: 1, inputPointIds: ['pt-A', 'pt-B'] },
            highlightIds: [],
            tool: 'macro',
          },
          {
            instruction: 'try to use unlabeled output',
            expected: { type: 'compass', centerId: 'pt-D', radiusPointId: 'pt-A' },
            highlightIds: [],
            tool: 'compass',
          },
        ],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-D')
      expect(errors[0].stepIndex).toBe(1)
    })
  })

  describe('ElementSelector string path', () => {
    it('validates point ID in string ElementSelector', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [{
          instruction: 'test',
          expected: {
            type: 'intersection',
            ofA: 'pt-WRONG',
            ofB: 'pt-B',
          },
          highlightIds: [],
          tool: null,
        }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(1)
      expect(errors[0].pointId).toBe('pt-WRONG')
    })

    it('ignores non-point string selectors (e.g. legacy cir-/seg- IDs)', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [{
          instruction: 'test',
          expected: {
            type: 'intersection',
            ofA: 'cir-1',
            ofB: 'seg-2',
          },
          highlightIds: [],
          tool: null,
        }],
      }
      // cir-1 and seg-2 are not point IDs — should not be validated as points
      const errors = validatePropositionDef(prop)
      expect(errors).toEqual([])
    })
  })

  describe('empty/minimal propositions', () => {
    it('proposition with no steps and no resultSegments is valid', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: minimalGiven('A', 'B'),
        steps: [],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toEqual([])
    })

    it('proposition with no given points fails on first step', () => {
      const prop: PropositionDef = {
        id: 99,
        title: 'test',
        givenElements: [],
        steps: [{
          instruction: 'test',
          expected: { type: 'compass', centerId: 'pt-A', radiusPointId: 'pt-B' },
          highlightIds: [],
          tool: 'compass',
        }],
      }
      const errors = validatePropositionDef(prop)
      expect(errors).toHaveLength(2)
    })
  })
})
