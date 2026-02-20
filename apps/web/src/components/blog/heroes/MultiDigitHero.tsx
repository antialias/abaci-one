'use client'

import { WorksheetTriptychHero, type TriptychPanel } from './WorksheetTriptychHero'

/**
 * Three scaffolding levels for 1027 + 2034 = 3061.
 * 4-digit addition with ones-column regrouping (7+4=11).
 * Demonstrates place value colors scaling with digit count.
 */
const PANELS: TriptychPanel[] = [
  {
    label: 'No Scaffolding',
    description: 'Standard format',
    body: {
      operator: 'addition',
      addend1: 1027,
      addend2: 2034,
      fontSize: 18,
      showCarryBoxes: false,
      showAnswerBoxes: false,
      showPlaceValueColors: false,
      showTenFrames: false,
    },
  },
  {
    label: 'Place Value Colors',
    description: 'See the columns',
    body: {
      operator: 'addition',
      addend1: 1027,
      addend2: 2034,
      fontSize: 18,
      showCarryBoxes: false,
      showAnswerBoxes: true,
      showPlaceValueColors: true,
      showTenFrames: false,
    },
  },
  {
    label: 'Colors + Carry Boxes',
    description: 'Full multi-digit support',
    body: {
      operator: 'addition',
      addend1: 1027,
      addend2: 2034,
      fontSize: 18,
      showCarryBoxes: true,
      showAnswerBoxes: true,
      showPlaceValueColors: true,
      showTenFrames: false,
    },
  },
]

export default function MultiDigitHero() {
  return <WorksheetTriptychHero panels={PANELS} componentName="multi-digit-hero" />
}
