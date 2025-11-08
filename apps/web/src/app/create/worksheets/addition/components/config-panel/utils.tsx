import type React from 'react'
import { css } from '../../../../../../../styled-system/css'

/**
 * Generate a human-readable summary of enabled scaffolding aids
 * Returns JSX with each frequency group on its own line
 */
export function getScaffoldingSummary(displayRules: any): React.ReactNode {
  console.log('[getScaffoldingSummary] displayRules:', displayRules)

  const alwaysItems: string[] = []
  const conditionalItems: string[] = []

  if (displayRules.carryBoxes === 'always') {
    alwaysItems.push('carry boxes')
  } else if (displayRules.carryBoxes !== 'never') {
    conditionalItems.push('carry boxes')
  }

  if (displayRules.answerBoxes === 'always') {
    alwaysItems.push('answer boxes')
  } else if (displayRules.answerBoxes !== 'never') {
    conditionalItems.push('answer boxes')
  }

  if (displayRules.placeValueColors === 'always') {
    alwaysItems.push('place value colors')
  } else if (displayRules.placeValueColors !== 'never') {
    conditionalItems.push('place value colors')
  }

  if (displayRules.tenFrames === 'always') {
    alwaysItems.push('ten-frames')
  } else if (displayRules.tenFrames !== 'never') {
    conditionalItems.push('ten-frames')
  }

  if (displayRules.borrowNotation === 'always') {
    alwaysItems.push('borrow notation')
  } else if (displayRules.borrowNotation !== 'never') {
    conditionalItems.push('borrow notation')
  }

  if (displayRules.borrowingHints === 'always') {
    alwaysItems.push('borrowing hints')
  } else if (displayRules.borrowingHints !== 'never') {
    conditionalItems.push('borrowing hints')
  }

  if (alwaysItems.length === 0 && conditionalItems.length === 0) {
    console.log('[getScaffoldingSummary] Final summary: no scaffolding')
    return <span className={css({ color: 'gray.500', fontStyle: 'italic' })}>no scaffolding</span>
  }

  console.log('[getScaffoldingSummary] Final summary:', { alwaysItems, conditionalItems })

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.5' })}>
      {alwaysItems.length > 0 && <div>Always: {alwaysItems.join(', ')}</div>}
      {conditionalItems.length > 0 && <div>When needed: {conditionalItems.join(', ')}</div>}
    </div>
  )
}
