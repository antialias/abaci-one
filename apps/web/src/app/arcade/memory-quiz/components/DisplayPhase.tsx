import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMemoryQuiz } from '../context/MemoryQuizContext'
import type { QuizCard } from '../types'

// Calculate maximum columns needed for a set of numbers
function calculateMaxColumns(numbers: number[]): number {
  if (numbers.length === 0) return 1
  const maxNumber = Math.max(...numbers)
  if (maxNumber === 0) return 1
  return Math.floor(Math.log10(maxNumber)) + 1
}

export function DisplayPhase() {
  const { state, nextCard, showInputPhase, resetGame, isRoomCreator } = useMemoryQuiz()
  const [currentCard, setCurrentCard] = useState<QuizCard | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const isDisplayPhaseActive = state.currentCardIndex < state.quizCards.length
  const isProcessingRef = useRef(false)
  const lastProcessedIndexRef = useRef(-1)
  const appConfig = useAbacusConfig()

  // In multiplayer room mode, only the room creator controls card timing
  // In local mode (isRoomCreator === undefined), allow timing control
  const shouldControlTiming = isRoomCreator === undefined || isRoomCreator === true

  // Calculate maximum columns needed for this quiz set
  const maxColumns = useMemo(() => {
    const allNumbers = state.quizCards.map((card) => card.number)
    return calculateMaxColumns(allNumbers)
  }, [state.quizCards])

  // Calculate adaptive animation duration
  const flashDuration = useMemo(() => {
    const displayTimeMs = state.displayTime * 1000
    return Math.min(Math.max(displayTimeMs * 0.3, 150), 600) / 1000 // Convert to seconds for CSS
  }, [state.displayTime])

  const progressPercentage = (state.currentCardIndex / state.quizCards.length) * 100

  useEffect(() => {
    // Prevent processing the same card index multiple times
    // This prevents race conditions from optimistic updates
    if (state.currentCardIndex === lastProcessedIndexRef.current) {
      console.log(
        `DisplayPhase: Skipping duplicate processing of index ${state.currentCardIndex} (lastProcessed: ${lastProcessedIndexRef.current})`
      )
      return
    }

    if (state.currentCardIndex >= state.quizCards.length) {
      // Only the room creator (or local mode) triggers phase transitions
      if (shouldControlTiming) {
        console.log(
          `DisplayPhase: All cards shown (${state.quizCards.length}), transitioning to input phase`
        )
        showInputPhase?.()
      }
      return
    }

    // Prevent multiple concurrent executions
    if (isProcessingRef.current) {
      console.log(
        `DisplayPhase: Already processing, skipping (index: ${state.currentCardIndex}, lastProcessed: ${lastProcessedIndexRef.current})`
      )
      return
    }

    // Mark this index as being processed
    lastProcessedIndexRef.current = state.currentCardIndex

    const showNextCard = async () => {
      isProcessingRef.current = true
      const card = state.quizCards[state.currentCardIndex]
      console.log(
        `DisplayPhase: Showing card ${state.currentCardIndex + 1}/${state.quizCards.length}, number: ${card.number} (isRoomCreator: ${isRoomCreator}, shouldControlTiming: ${shouldControlTiming})`
      )

      // Calculate adaptive timing based on display speed
      const displayTimeMs = state.displayTime * 1000
      const flashDuration = Math.min(Math.max(displayTimeMs * 0.3, 150), 600) // 30% of display time, between 150ms-600ms
      const transitionPause = Math.min(Math.max(displayTimeMs * 0.1, 50), 200) // 10% of display time, between 50ms-200ms

      // Trigger adaptive transition effect
      setIsTransitioning(true)
      setCurrentCard(card)

      // Reset transition effect with adaptive duration
      setTimeout(() => setIsTransitioning(false), flashDuration)

      console.log(
        `DisplayPhase: Card ${state.currentCardIndex + 1} now visible (flash: ${flashDuration}ms, pause: ${transitionPause}ms)`
      )

      // Only the room creator (or local mode) controls the timing
      if (shouldControlTiming) {
        // Display card for specified time with adaptive transition pause
        await new Promise((resolve) => setTimeout(resolve, displayTimeMs - transitionPause))

        // Don't hide the abacus - just advance to next card for smooth transition
        console.log(
          `DisplayPhase: Card ${state.currentCardIndex + 1} transitioning to next (controlled by ${isRoomCreator === undefined ? 'local mode' : 'room creator'})`
        )
        await new Promise((resolve) => setTimeout(resolve, transitionPause)) // Adaptive pause for visual transition

        isProcessingRef.current = false
        nextCard?.()
      } else {
        // Non-creator players just display the card, don't control timing
        console.log(
          `DisplayPhase: Non-creator player displaying card ${state.currentCardIndex + 1}, waiting for creator to advance`
        )
        isProcessingRef.current = false
      }
    }

    showNextCard()
  }, [
    state.currentCardIndex,
    state.displayTime,
    state.quizCards.length,
    nextCard,
    showInputPhase,
    shouldControlTiming,
    isRoomCreator,
  ])

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
        height: '100%',
        animation: isTransitioning ? `subtlePageFlash ${flashDuration}s ease-out` : undefined,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '800px',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div>
          <div
            style={{
              width: '100%',
              height: '8px',
              background: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #28a745, #20c997)',
                borderRadius: '4px',
                width: `${progressPercentage}%`,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#374151',
            }}
          >
            Card {state.currentCardIndex + 1} of {state.quizCards.length}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            onClick={() => resetGame?.()}
          >
            End Quiz
          </button>
        </div>
      </div>

      {/* Persistent abacus container - stays mounted during entire memorize phase */}
      <div
        style={{
          width: 'min(90vw, 800px)',
          height: 'min(70vh, 500px)',
          display: isDisplayPhaseActive ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          transition: 'opacity 0.3s ease',
          overflow: 'visible',
          padding: '20px 12px',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          {/* Persistent abacus with smooth bead animations and dynamically calculated columns */}
          <AbacusReact
            value={currentCard?.number || 0}
            columns={maxColumns}
            beadShape={appConfig.beadShape}
            colorScheme={appConfig.colorScheme}
            hideInactiveBeads={appConfig.hideInactiveBeads}
            scaleFactor={5.5}
            interactive={false}
            showNumbers={false}
            animated={true}
          />
        </div>
      </div>
    </div>
  )
}
