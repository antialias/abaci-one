import type { PropositionDef, ConstructionElement } from '../types'
import { BYRNE } from '../types'

const givenElements: ConstructionElement[] = [
  {
    kind: 'point',
    id: 'pt-A',
    x: 0,
    y: 0,
    label: 'A',
    color: BYRNE.given,
    origin: 'given',
  },
]

/**
 * Playground "proposition" — free-form construction sandbox.
 * Starts with a single moveable point; the user adds more via the Point tool.
 */
export const PLAYGROUND_PROP: PropositionDef = {
  id: 0,
  title: 'Construction Playground',
  givenElements,
  draggablePointIds: ['pt-A'],
  steps: [],
}
