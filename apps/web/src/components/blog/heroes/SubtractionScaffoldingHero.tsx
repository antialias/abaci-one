'use client'

import { WorksheetTriptychHero, type TriptychPanel } from './WorksheetTriptychHero'

/**
 * Three scaffolding levels for 352 − 117 = 235.
 * Ones-column borrowing only — demonstrates conditional scaffolding.
 */
const PANELS: TriptychPanel[] = [
  {
    label: 'No Scaffolding',
    description: 'Standard format',
    body: {
      operator: 'subtraction',
      minuend: 352,
      subtrahend: 117,
      fontSize: 18,
      showCarryBoxes: false,
      showAnswerBoxes: false,
      showPlaceValueColors: false,
      showBorrowNotation: false,
      showBorrowingHints: false,
      showTenFrames: false,
    },
  },
  {
    label: 'Colors + Boxes',
    description: 'Visual structure',
    body: {
      operator: 'subtraction',
      minuend: 352,
      subtrahend: 117,
      fontSize: 18,
      showCarryBoxes: false,
      showAnswerBoxes: true,
      showPlaceValueColors: true,
      showBorrowNotation: false,
      showBorrowingHints: false,
      showTenFrames: false,
    },
  },
  {
    label: 'Full Scaffolding',
    description: 'Guided borrowing',
    body: {
      operator: 'subtraction',
      minuend: 352,
      subtrahend: 117,
      fontSize: 18,
      showCarryBoxes: true,
      showAnswerBoxes: true,
      showPlaceValueColors: true,
      showBorrowNotation: true,
      showBorrowingHints: true,
      showTenFrames: true,
    },
  },
]

export default function SubtractionScaffoldingHero() {
  return <WorksheetTriptychHero panels={PANELS} componentName="subtraction-scaffolding-hero" />
}
