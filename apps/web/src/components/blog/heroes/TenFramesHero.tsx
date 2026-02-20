'use client'

import { WorksheetTriptychHero, type TriptychPanel } from './WorksheetTriptychHero'

/**
 * Three scaffolding levels for 27 + 14 = 41.
 * Ones-column regrouping (7+4=11) — shows ten-frames on the regrouping column.
 */
const PANELS: TriptychPanel[] = [
  {
    label: 'No Scaffolding',
    description: 'Standard format',
    body: {
      operator: 'addition',
      addend1: 27,
      addend2: 14,
      fontSize: 18,
      showCarryBoxes: false,
      showAnswerBoxes: false,
      showPlaceValueColors: false,
      showTenFrames: false,
    },
  },
  {
    label: 'Carry Boxes + Colors',
    description: 'Track regrouping',
    body: {
      operator: 'addition',
      addend1: 27,
      addend2: 14,
      fontSize: 18,
      showCarryBoxes: true,
      showAnswerBoxes: true,
      showPlaceValueColors: true,
      showTenFrames: false,
    },
  },
  {
    label: 'With Ten-Frames',
    description: 'Visualize the "make ten"',
    body: {
      operator: 'addition',
      addend1: 27,
      addend2: 14,
      fontSize: 18,
      showCarryBoxes: true,
      showAnswerBoxes: true,
      showPlaceValueColors: true,
      showTenFrames: true,
    },
  },
]

export default function TenFramesHero() {
  return <WorksheetTriptychHero panels={PANELS} componentName="ten-frames-hero" />
}
