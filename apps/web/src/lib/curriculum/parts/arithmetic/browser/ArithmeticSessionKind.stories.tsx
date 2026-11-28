import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { SessionShell } from '@/components/practice/session/SessionShell'
import type { BroadcastState } from '@/components/practice/session/types'
import type { SlotResult } from '@/db/schema/session-plans'
import {
  createMockSessionPlanWithProblems,
  createMockStudent,
  defaultHandlers,
} from '@/test/fixtures/story-session-plans'
import { css } from '../../../../../../styled-system/css'
import { arithmeticSessionKind } from '../browser'

/**
 * Arithmetic's browser views as the session shell reads them through the
 * browser registry (practice-kinds K5a-3b): its item view in each
 * presentation, its observer view, its try card and its round interlude.
 */
const meta: Meta = {
  title: 'Practice/Kinds/Arithmetic',
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj

const { ObserverView, TryCard, Interlude } = arithmeticSessionKind

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-component="arithmetic-story-frame"
      className={css({ backgroundColor: 'gray.100', minHeight: '100vh', padding: '1rem' })}
    >
      {children}
    </div>
  )
}

/** The item view through the shell, on the part with the given presentation. */
function ItemViewOn({ partIndex }: { partIndex: 0 | 1 | 2 }) {
  const [plan] = useState(() =>
    createMockSessionPlanWithProblems({ skillLevel: 'basic', currentPartIndex: partIndex })
  )
  return (
    <Frame>
      <SessionShell plan={plan} student={createMockStudent('Sonia')} {...defaultHandlers} />
    </Frame>
  )
}

/** Presentation 'abacus': vertical, with the abacus dock */
export const ItemViewAbacus: Story = { render: () => <ItemViewOn partIndex={0} /> }

/** Presentation 'visualization': vertical, no abacus */
export const ItemViewVisualization: Story = { render: () => <ItemViewOn partIndex={1} /> }

/** Presentation 'linear': the number sentence */
export const ItemViewLinear: Story = { render: () => <ItemViewOn partIndex={2} /> }

const observed: BroadcastState = {
  currentProblem: { terms: [5, 3, -2], answer: 6 },
  slotId: 'story-slot-0',
  phase: 'problem',
  studentAnswer: '6',
  isCorrect: null,
  startedAt: Date.now(),
  purpose: 'focus',
  item: { partIndex: 0, itemId: 'story-slot-0', doOver: false, round: 0 },
}

/** What a teacher watches: the problem as the kid types it */
export const ObserverViewTyping: Story = {
  render: () => (
    <Frame>
      <ObserverView state={observed} presentation="abacus" isDark={false} />
    </Frame>
  ),
}

/** What a teacher watches: a wrong answer's feedback, linear */
export const ObserverViewFeedback: Story = {
  render: () => (
    <Frame>
      <ObserverView
        state={{ ...observed, phase: 'feedback', studentAnswer: '7', isCorrect: false }}
        presentation="linear"
        isDark={false}
      />
    </Frame>
  ),
}

const recorded: SlotResult = {
  slotId: 'story-slot-0',
  partNumber: 1,
  slotIndex: 0,
  problem: { terms: [5, 3, -2], answer: 6, skillsRequired: ['basic.directAddition'] },
  studentAnswer: 6,
  isCorrect: true,
  responseTimeMs: 4200,
  skillsExercised: ['basic.directAddition'],
  usedOnScreenAbacus: false,
  timestamp: new Date(),
  hadHelp: false,
  incorrectAttempts: 0,
}

/** A recorded try, right, vertical */
export const TryCardCorrect: Story = {
  render: () => (
    <Frame>
      <TryCard result={recorded} presentation="abacus" isDark={false} />
    </Frame>
  ),
}

/** A recorded try, wrong, linear */
export const TryCardWrongLinear: Story = {
  render: () => (
    <Frame>
      <TryCard
        result={{ ...recorded, studentAnswer: 7, isCorrect: false }}
        presentation="linear"
        isDark={false}
      />
    </Frame>
  ),
}

/** The screen before a retry round */
export const InterludeRetryRound: Story = {
  render: () => (
    <Interlude
      isVisible
      round={1}
      itemCount={3}
      student={{ name: 'Sonia', emoji: '🌟' }}
      onComplete={() => console.log('Interlude complete')}
    />
  ),
}
