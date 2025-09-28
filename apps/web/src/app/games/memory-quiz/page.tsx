'use client'

import Link from 'next/link'
import React, { useEffect, useReducer, useRef, useCallback, useMemo, useState } from 'react'
import { css } from '../../../../styled-system/css'
import { AbacusReact } from '@soroban/abacus-react'
import { useAbacusConfig } from '../../../contexts/AbacusDisplayContext'
import { isPrefix } from '../../../lib/memory-quiz-utils'
import { FullscreenGameLayout } from '../../../components/FullscreenGameLayout'


interface QuizCard {
  number: number
  svgComponent: JSX.Element
  element: HTMLElement | null
}

interface SorobanQuizState {
  // Core game data
  cards: QuizCard[]
  quizCards: QuizCard[]
  correctAnswers: number[]

  // Game progression
  currentCardIndex: number
  displayTime: number
  selectedCount: number
  selectedDifficulty: DifficultyLevel

  // Input system state
  foundNumbers: number[]
  guessesRemaining: number
  currentInput: string
  incorrectGuesses: number

  // UI state
  gamePhase: 'setup' | 'display' | 'input' | 'results'
  prefixAcceptanceTimeout: NodeJS.Timeout | null
  finishButtonsBound: boolean
  wrongGuessAnimations: Array<{
    number: number
    id: string
    timestamp: number
  }>
}

type QuizAction =
  | { type: 'SET_CARDS'; cards: QuizCard[] }
  | { type: 'SET_DISPLAY_TIME'; time: number }
  | { type: 'SET_SELECTED_COUNT'; count: number }
  | { type: 'SET_DIFFICULTY'; difficulty: DifficultyLevel }
  | { type: 'START_QUIZ'; quizCards: QuizCard[] }
  | { type: 'NEXT_CARD' }
  | { type: 'SHOW_INPUT_PHASE' }
  | { type: 'ACCEPT_NUMBER'; number: number }
  | { type: 'REJECT_NUMBER' }
  | { type: 'ADD_WRONG_GUESS_ANIMATION'; number: number }
  | { type: 'CLEAR_WRONG_GUESS_ANIMATIONS' }
  | { type: 'SET_INPUT'; input: string }
  | { type: 'SET_PREFIX_TIMEOUT'; timeout: NodeJS.Timeout | null }
  | { type: 'SHOW_RESULTS' }
  | { type: 'RESET_QUIZ' }

const initialState: SorobanQuizState = {
  cards: [],
  quizCards: [],
  correctAnswers: [],
  currentCardIndex: 0,
  displayTime: 2.0,
  selectedCount: 5,
  selectedDifficulty: 'easy', // Default to easy level
  foundNumbers: [],
  guessesRemaining: 0,
  currentInput: '',
  incorrectGuesses: 0,
  gamePhase: 'setup',
  prefixAcceptanceTimeout: null,
  finishButtonsBound: false,
  wrongGuessAnimations: []
}

function quizReducer(state: SorobanQuizState, action: QuizAction): SorobanQuizState {
  switch (action.type) {
    case 'SET_CARDS':
      return { ...state, cards: action.cards }
    case 'SET_DISPLAY_TIME':
      return { ...state, displayTime: action.time }
    case 'SET_SELECTED_COUNT':
      return { ...state, selectedCount: action.count }
    case 'SET_DIFFICULTY':
      return { ...state, selectedDifficulty: action.difficulty }
    case 'START_QUIZ':
      return {
        ...state,
        quizCards: action.quizCards,
        correctAnswers: action.quizCards.map(card => card.number),
        currentCardIndex: 0,
        foundNumbers: [],
        guessesRemaining: action.quizCards.length + Math.floor(action.quizCards.length / 2),
        gamePhase: 'display'
      }
    case 'NEXT_CARD':
      return { ...state, currentCardIndex: state.currentCardIndex + 1 }
    case 'SHOW_INPUT_PHASE':
      return { ...state, gamePhase: 'input' }
    case 'ACCEPT_NUMBER':
      return {
        ...state,
        foundNumbers: [...state.foundNumbers, action.number],
        currentInput: ''
      }
    case 'REJECT_NUMBER':
      return {
        ...state,
        guessesRemaining: state.guessesRemaining - 1,
        incorrectGuesses: state.incorrectGuesses + 1,
        currentInput: ''
      }
    case 'SET_INPUT':
      return { ...state, currentInput: action.input }
    case 'SET_PREFIX_TIMEOUT':
      return { ...state, prefixAcceptanceTimeout: action.timeout }
    case 'ADD_WRONG_GUESS_ANIMATION':
      return {
        ...state,
        wrongGuessAnimations: [
          ...state.wrongGuessAnimations,
          {
            number: action.number,
            id: `wrong-${action.number}-${Date.now()}`,
            timestamp: Date.now()
          }
        ]
      }
    case 'CLEAR_WRONG_GUESS_ANIMATIONS':
      return {
        ...state,
        wrongGuessAnimations: []
      }
    case 'SHOW_RESULTS':
      return { ...state, gamePhase: 'results' }
    case 'RESET_QUIZ':
      return {
        ...initialState,
        cards: state.cards, // Preserve generated cards
        displayTime: state.displayTime,
        selectedCount: state.selectedCount,
        selectedDifficulty: state.selectedDifficulty
      }
    default:
      return state
  }
}

// Difficulty levels with progressive number ranges
const DIFFICULTY_LEVELS = {
  beginner: { name: 'Beginner', range: { min: 1, max: 9 }, description: 'Single digits (1-9)' },
  easy: { name: 'Easy', range: { min: 10, max: 99 }, description: 'Two digits (10-99)' },
  medium: { name: 'Medium', range: { min: 100, max: 499 }, description: 'Three digits (100-499)' },
  hard: { name: 'Hard', range: { min: 500, max: 999 }, description: 'Large numbers (500-999)' },
  expert: { name: 'Expert', range: { min: 1, max: 999 }, description: 'Mixed range (1-999)' }
} as const

type DifficultyLevel = keyof typeof DIFFICULTY_LEVELS

// Generate quiz cards with difficulty-based number ranges
const generateQuizCards = (count: number, difficulty: DifficultyLevel, appConfig: any): QuizCard[] => {
  const { min, max } = DIFFICULTY_LEVELS[difficulty].range

  // Generate unique numbers - no duplicates allowed
  const numbers: number[] = []
  const maxAttempts = (max - min + 1) * 10 // Prevent infinite loops
  let attempts = 0

  while (numbers.length < count && attempts < maxAttempts) {
    const newNumber = Math.floor(Math.random() * (max - min + 1)) + min
    if (!numbers.includes(newNumber)) {
      numbers.push(newNumber)
    }
    attempts++
  }

  // If we couldn't generate enough unique numbers, fill with sequential numbers
  if (numbers.length < count) {
    for (let i = min; i <= max && numbers.length < count; i++) {
      if (!numbers.includes(i)) {
        numbers.push(i)
      }
    }
  }

  return numbers.map(number => ({
    number,
    svgComponent: <AbacusReact
      value={number}
      columns="auto"
      beadShape={appConfig.beadShape}
      colorScheme={appConfig.colorScheme}
      hideInactiveBeads={appConfig.hideInactiveBeads}
      scaleFactor={1.0}
      interactive={false}
      showNumbers={false}
      animated={false}
    />,
    element: null
  }))
}

// React component for the setup phase
function SetupPhase({ state, dispatch }: { state: SorobanQuizState; dispatch: React.Dispatch<QuizAction> }) {
  const appConfig = useAbacusConfig()

  const handleCountSelect = (count: number) => {
    dispatch({ type: 'SET_SELECTED_COUNT', count })
  }

  const handleTimeChange = (time: number) => {
    dispatch({ type: 'SET_DISPLAY_TIME', time })
  }

  const handleDifficultySelect = (difficulty: DifficultyLevel) => {
    dispatch({ type: 'SET_DIFFICULTY', difficulty })
  }

  const handleStartQuiz = () => {
    const quizCards = generateQuizCards(state.selectedCount, state.selectedDifficulty, appConfig)
    dispatch({ type: 'START_QUIZ', quizCards })
  }

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '12px',
        maxWidth: '100%',
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <h2 style={{ color: '#374151', margin: '0 0 8px 0', fontSize: '18px' }}>🧠 Speed Memory Quiz</h2>
      <p style={{ color: '#6b7280', margin: '0 0 16px 0', fontSize: '14px' }}>Test your soroban reading skills! Cards will be shown briefly, then you'll enter the numbers you remember.</p>

      <div
        style={{
          maxWidth: '100%',
          margin: '0 auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflow: 'auto'
        }}
      >
        <div style={{ margin: '12px 0' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#6b7280', fontSize: '14px' }}>Difficulty Level:</label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              justifyContent: 'center'
            }}
          >
            {Object.entries(DIFFICULTY_LEVELS).map(([key, level]) => (
              <button
                key={key}
                type="button"
                style={{
                  background: state.selectedDifficulty === key ? '#3b82f6' : 'white',
                  color: state.selectedDifficulty === key ? 'white' : '#1f2937',
                  border: '2px solid',
                  borderColor: state.selectedDifficulty === key ? '#3b82f6' : '#d1d5db',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  fontSize: '12px'
                }}
                onClick={() => handleDifficultySelect(key as DifficultyLevel)}
                title={level.description}
              >
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{level.name}</div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{level.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className={css({ margin: '20px 0' })}>
          <label className={css({ display: 'block', fontWeight: 'bold', marginBottom: '10px', color: 'gray.600' })}>Cards to Quiz:</label>
          <div className={css({
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          })}>
            {[2, 5, 8, 12, 15].map(count => (
              <button
                key={count}
                type="button"
                className={css({
                  background: state.selectedCount === count ? 'blue.500' : 'white',
                  color: state.selectedCount === count ? 'white' : 'gray.800',
                  border: '2px solid',
                  borderColor: state.selectedCount === count ? 'blue.500' : 'gray.300',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '16px',
                  _hover: {
                    background: state.selectedCount === count ? 'blue.600' : 'gray.50',
                    borderColor: 'blue.400'
                  }
                })}
                onClick={() => handleCountSelect(count)}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className={css({ margin: '20px 0' })}>
          <label className={css({ display: 'block', fontWeight: 'bold', marginBottom: '10px', color: 'gray.600' })}>Display Time per Card:</label>
          <div className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '15px'
          })}>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={state.displayTime}
              onChange={(e) => handleTimeChange(parseFloat(e.target.value))}
              className={css({
                flex: 1,
                maxWidth: '300px'
              })}
            />
            <span className={css({
              fontWeight: 'bold',
              color: 'blue.500',
              minWidth: '50px'
            })}>{state.displayTime.toFixed(1)}s</span>
          </div>
        </div>

        <button
          className={css({
            background: 'green.500',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '15px 30px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
            marginTop: '20px',
            _hover: { background: 'green.600' }
          })}
          onClick={handleStartQuiz}
        >
          Start Quiz
        </button>
      </div>
    </div>
  )
}

// Calculate maximum columns needed for a set of numbers
function calculateMaxColumns(numbers: number[]): number {
  if (numbers.length === 0) return 1
  const maxNumber = Math.max(...numbers)
  if (maxNumber === 0) return 1
  return Math.floor(Math.log10(maxNumber)) + 1
}

// React component for the display phase
function DisplayPhase({ state, dispatch }: { state: SorobanQuizState; dispatch: React.Dispatch<QuizAction> }) {
  const [currentCard, setCurrentCard] = useState<QuizCard | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const isDisplayPhaseActive = state.currentCardIndex < state.quizCards.length
  const isProcessingRef = useRef(false)
  const appConfig = useAbacusConfig()

  // Calculate maximum columns needed for this quiz set
  const maxColumns = useMemo(() => {
    const allNumbers = state.quizCards.map(card => card.number)
    return calculateMaxColumns(allNumbers)
  }, [state.quizCards])

  // Calculate adaptive animation duration
  const flashDuration = useMemo(() => {
    const displayTimeMs = state.displayTime * 1000
    return Math.min(Math.max(displayTimeMs * 0.3, 150), 600) / 1000 // Convert to seconds for CSS
  }, [state.displayTime])

  const progressPercentage = (state.currentCardIndex / state.quizCards.length) * 100

  useEffect(() => {
    if (state.currentCardIndex >= state.quizCards.length) {
      dispatch({ type: 'SHOW_INPUT_PHASE' })
      return
    }

    // Prevent multiple concurrent executions
    if (isProcessingRef.current) {
      return
    }

    const showNextCard = async () => {
      isProcessingRef.current = true
      const card = state.quizCards[state.currentCardIndex]
      console.log(`DisplayPhase: Showing card ${state.currentCardIndex + 1}/${state.quizCards.length}, number: ${card.number}`)

      // Calculate adaptive timing based on display speed
      const displayTimeMs = state.displayTime * 1000
      const flashDuration = Math.min(Math.max(displayTimeMs * 0.3, 150), 600) // 30% of display time, between 150ms-600ms
      const transitionPause = Math.min(Math.max(displayTimeMs * 0.1, 50), 200) // 10% of display time, between 50ms-200ms

      // Trigger adaptive transition effect
      setIsTransitioning(true)
      setCurrentCard(card)

      // Reset transition effect with adaptive duration
      setTimeout(() => setIsTransitioning(false), flashDuration)

      console.log(`DisplayPhase: Card ${state.currentCardIndex + 1} now visible (flash: ${flashDuration}ms, pause: ${transitionPause}ms)`)

      // Display card for specified time with adaptive transition pause
      await new Promise(resolve => setTimeout(resolve, displayTimeMs - transitionPause))

      // Don't hide the abacus - just advance to next card for smooth transition
      console.log(`DisplayPhase: Card ${state.currentCardIndex + 1} transitioning to next`)
      await new Promise(resolve => setTimeout(resolve, transitionPause)) // Adaptive pause for visual transition

      isProcessingRef.current = false
      dispatch({ type: 'NEXT_CARD' })
    }

    showNextCard()
  }, [state.currentCardIndex, state.displayTime, state.quizCards.length, dispatch])

  return (
    <div
      className={css({
        textAlign: 'center',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
        height: '100%'
      })}
      style={{
        animation: isTransitioning ? `subtlePageFlash ${flashDuration}s ease-out` : undefined
      }}
    >
      <div className={css({
        position: 'relative',
        width: '100%',
        maxWidth: '800px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      })}>
        <div className={css({})}>
          <div className={css({
            width: '100%',
            height: '10px',
            background: 'gray.200',
            borderRadius: '5px',
            overflow: 'hidden',
            marginBottom: '10px'
          })}>
            <div
              className={css({
                height: '100%',
                background: 'linear-gradient(90deg, #28a745, #20c997)',
                borderRadius: '5px',
                width: '0%',
                transition: 'width 0.5s ease'
              })}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className={css({
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'gray.700'
          })}>
            Card {state.currentCardIndex + 1} of {state.quizCards.length}
          </span>
        </div>
        <div className={css({ display: 'flex', justifyContent: 'flex-end' })}>
          <button
            className={css({
              background: 'red.500',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
              _hover: { background: 'red.600' }
            })}
            onClick={() => dispatch({ type: 'RESET_QUIZ' })}
          >
            End Quiz
          </button>
        </div>
      </div>


      {/* Persistent abacus container - stays mounted during entire memorize phase */}
      <div className={css({
        width: 'min(90vw, 800px)',
        height: 'min(80vh, 700px)',
        display: isDisplayPhaseActive ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        transition: 'opacity 0.3s ease',
        overflow: 'visible',
        padding: '40px 20px'
      })}>
        <div className={css({
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '30px'
        })}>

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

// Visual card grid component with adaptive layout
function CardGrid({ state }: { state: SorobanQuizState }) {
  if (state.quizCards.length === 0) return null

  // Calculate optimal grid layout based on number of cards
  const cardCount = state.quizCards.length

  // Define static grid classes that Panda can generate
  const getGridClass = (count: number) => {
    if (count <= 2) return 'repeat(2, 1fr)'
    if (count <= 4) return 'repeat(2, 1fr)'
    if (count <= 6) return 'repeat(3, 1fr)'
    if (count <= 9) return 'repeat(3, 1fr)'
    if (count <= 12) return 'repeat(4, 1fr)'
    return 'repeat(5, 1fr)'
  }

  const getCardSize = (count: number) => {
    if (count <= 2) return { minSize: '180px', cardHeight: '160px' }
    if (count <= 4) return { minSize: '160px', cardHeight: '150px' }
    if (count <= 6) return { minSize: '140px', cardHeight: '140px' }
    if (count <= 9) return { minSize: '120px', cardHeight: '130px' }
    if (count <= 12) return { minSize: '110px', cardHeight: '120px' }
    return { minSize: '100px', cardHeight: '110px' }
  }

  const gridClass = getGridClass(cardCount)
  const cardSize = getCardSize(cardCount)

  return (
    <div className={css({
      marginTop: '16px',
      padding: '16px',
      background: 'gray.50',
      borderRadius: '12px',
      border: '1px solid',
      borderColor: 'gray.200',
      maxHeight: '60vh',
      overflowY: 'auto'
    })}>
      <h4 className={css({
        textAlign: 'center',
        color: 'gray.700',
        marginBottom: '16px',
        fontSize: '16px',
        fontWeight: '600'
      })}>Cards you saw ({cardCount}):</h4>

      <div
        className={css({
          display: 'grid',
          gap: '12px',
          maxWidth: '100%',
          margin: '0 auto',
          width: 'fit-content',

          // Responsive overrides with static values
          '@media (max-width: 768px)': {
            gap: '10px'
          },
          '@media (max-width: 480px)': {
            gap: '8px'
          }
        })}
        style={{
          gridTemplateColumns: gridClass
        }}
      >
        {state.quizCards.map((card, index) => {
          const isRevealed = state.foundNumbers.includes(card.number)
          return (
            <div
              key={`card-${index}-${card.number}`}
              className={css({
                perspective: '1000px',
                maxWidth: '200px',

                // Static responsive sizing fallbacks
                '@media (max-width: 768px)': {
                  height: '130px',
                  minWidth: '100px'
                },
                '@media (max-width: 480px)': {
                  height: '120px',
                  minWidth: '90px'
                }
              })}
              style={{
                height: cardSize.cardHeight,
                minWidth: cardSize.minSize
              }}
            >
              <div className={css({
                position: 'relative',
                width: '100%',
                height: '100%',
                textAlign: 'center',
                transition: 'transform 0.8s',
                transformStyle: 'preserve-3d',
                transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)'
              })}>
                {/* Card back (hidden state) */}
                <div className={css({
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                  color: 'white',
                  fontSize: '48px',

                  // Responsive font sizing
                  '@media (max-width: 768px)': {
                    fontSize: '40px'
                  },
                  '@media (max-width: 480px)': {
                    fontSize: '32px'
                  },
                  fontWeight: 'bold',
                  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
                  border: '3px solid #5f3dc4'
                })}>
                  <div className={css({ opacity: 0.8 })}>?</div>
                </div>

                {/* Card front (revealed state) */}
                <div className={css({
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  background: 'white',
                  border: '3px solid #28a745',
                  transform: 'rotateY(180deg)'
                })}>
                  <div className={css({
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    padding: '4px'
                  })}>
                    <div className={css({
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    })}>
                      <AbacusReact
                        value={card.number}
                        columns="auto"
                        beadShape="diamond"
                        colorScheme="place-value"
                        hideInactiveBeads={false}
                        scaleFactor={1.2}
                        interactive={false}
                        showNumbers={false}
                        animated={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary row for large numbers of cards */}
      {cardCount > 8 && (
        <div className={css({
          marginTop: '12px',
          padding: '8px 12px',
          background: 'blue.50',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: 'blue.200',
          textAlign: 'center',
          fontSize: '14px',
          color: 'blue.700'
        })}>
          <strong>{state.foundNumbers.length}</strong> of <strong>{cardCount}</strong> cards found
          {state.foundNumbers.length > 0 && (
            <span className={css({ marginLeft: '8px', fontWeight: 'normal' })}>
              ({Math.round((state.foundNumbers.length / cardCount) * 100)}% complete)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Results card grid that reuses CardGrid with all cards revealed and success/failure indicators
function ResultsCardGrid({ state }: { state: SorobanQuizState }) {
  if (state.quizCards.length === 0) return null

  // Create a modified state where all cards are revealed for results display
  const resultsState = {
    ...state,
    revealedCards: state.quizCards.map(card => card.number) // Reveal all cards
  }

  // Calculate optimal grid layout based on number of cards (same as CardGrid)
  const cardCount = state.quizCards.length

  // Define static grid classes that Panda can generate (same as CardGrid)
  const getGridClass = (count: number) => {
    if (count <= 2) return 'repeat(2, 1fr)'
    if (count <= 4) return 'repeat(2, 1fr)'
    if (count <= 6) return 'repeat(3, 1fr)'
    if (count <= 9) return 'repeat(3, 1fr)'
    if (count <= 12) return 'repeat(4, 1fr)'
    return 'repeat(5, 1fr)'
  }

  const getCardSize = (count: number) => {
    if (count <= 2) return { minSize: '180px', cardHeight: '160px' }
    if (count <= 4) return { minSize: '160px', cardHeight: '150px' }
    if (count <= 6) return { minSize: '140px', cardHeight: '140px' }
    if (count <= 9) return { minSize: '120px', cardHeight: '130px' }
    if (count <= 12) return { minSize: '110px', cardHeight: '120px' }
    return { minSize: '100px', cardHeight: '110px' }
  }

  const gridClass = getGridClass(cardCount)
  const cardSize = getCardSize(cardCount)

  return (
    <div>
      <div
        className={css({
          display: 'grid',
          gap: '12px',
          padding: '8px',
          justifyContent: 'center',
          maxWidth: '100%',
          margin: '0 auto'
        })}
        style={{
          gridTemplateColumns: gridClass
        }}
      >
        {state.quizCards.map((card, index) => {
          const isRevealed = true // All cards revealed in results
          const wasFound = state.foundNumbers.includes(card.number)

          return (
            <div
              key={`${card.number}-${index}`}
              className={css({
                perspective: '1000px',
                position: 'relative',
                aspectRatio: '3/4',
                '@media (min-width: 1024px)': {
                  aspectRatio: '3/4',
                  height: '120px',
                  minWidth: '90px'
                }
              })}
              style={{
                height: cardSize.cardHeight,
                minWidth: cardSize.minSize
              }}
            >
              <div className={css({
                position: 'relative',
                width: '100%',
                height: '100%',
                textAlign: 'center',
                transition: 'transform 0.8s',
                transformStyle: 'preserve-3d',
                transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)'
              })}>
                {/* Card back (hidden state) - not visible in results */}
                <div className={css({
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                  color: 'white',
                  fontSize: '48px',
                  '@media (max-width: 768px)': {
                    fontSize: '40px'
                  },
                  '@media (max-width: 480px)': {
                    fontSize: '32px'
                  },
                  fontWeight: 'bold',
                  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
                  border: '3px solid #5f3dc4'
                })}>
                  <div className={css({ opacity: 0.8 })}>?</div>
                </div>

                {/* Card front (revealed state) with success/failure indicators */}
                <div className={css({
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  background: 'white',
                  border: '3px solid',
                  borderColor: wasFound ? 'green.500' : 'red.500',
                  transform: 'rotateY(180deg)'
                })}>
                  <div className={css({
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    padding: '4px'
                  })}>
                    <div className={css({
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    })}>
                      <AbacusReact
                        value={card.number}
                        columns="auto"
                        beadShape="diamond"
                        colorScheme="place-value"
                        hideInactiveBeads={false}
                        scaleFactor={1.2}
                        interactive={false}
                        showNumbers={false}
                        animated={false}
                      />
                    </div>
                  </div>

                  {/* Right/Wrong indicator overlay */}
                  <div className={css({
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: wasFound ? 'green.500' : 'red.500',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                  })}>
                    {wasFound ? '✓' : '✗'}
                  </div>

                  {/* Number label overlay */}
                  <div className={css({
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  })}>
                    {card.number}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary row for large numbers of cards (same as CardGrid) */}
      {cardCount > 8 && (
        <div className={css({
          marginTop: '12px',
          padding: '8px 12px',
          background: 'blue.50',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: 'blue.200',
          textAlign: 'center',
          fontSize: '14px',
          color: 'blue.700'
        })}>
          <strong>{state.foundNumbers.length}</strong> of <strong>{cardCount}</strong> cards found
          {state.foundNumbers.length > 0 && (
            <span className={css({ marginLeft: '8px', fontWeight: 'normal' })}>
              ({Math.round((state.foundNumbers.length / cardCount) * 100)}% complete)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// React component for the input phase
function InputPhase({ state, dispatch }: { state: SorobanQuizState; dispatch: React.Dispatch<QuizAction> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [displayFeedback, setDisplayFeedback] = useState<'neutral' | 'correct' | 'incorrect'>('neutral')


  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    // Only handle if input phase is active and guesses remain
    if (state.guessesRemaining === 0) return

    // Only handle number keys
    if (!/^[0-9]$/.test(e.key)) return

    const newInput = state.currentInput + e.key
    dispatch({ type: 'SET_INPUT', input: newInput })

    // Clear any existing timeout
    if (state.prefixAcceptanceTimeout) {
      clearTimeout(state.prefixAcceptanceTimeout)
      dispatch({ type: 'SET_PREFIX_TIMEOUT', timeout: null })
    }

    setDisplayFeedback('neutral')

    const number = parseInt(newInput)
    if (isNaN(number)) return

    // Check if correct and not already found
    if (state.correctAnswers.includes(number) && !state.foundNumbers.includes(number)) {
      if (!isPrefix(newInput, state.correctAnswers, state.foundNumbers)) {
        acceptCorrectNumber(number)
      } else {
        const timeout = setTimeout(() => {
          acceptCorrectNumber(number)
        }, 500)
        dispatch({ type: 'SET_PREFIX_TIMEOUT', timeout })
      }
    } else {
      // Check if this input could be a valid prefix or complete number
      const couldBePrefix = state.correctAnswers.some(n => n.toString().startsWith(newInput))
      const isCompleteWrongNumber = !state.correctAnswers.includes(number) && !couldBePrefix

      // Trigger explosion if:
      // 1. It's a complete wrong number (length >= 2 or can't be a prefix)
      // 2. It's a single digit that can't possibly be a prefix of any target
      if ((newInput.length >= 2 || isCompleteWrongNumber) && state.guessesRemaining > 0) {
        handleIncorrectGuess()
      }
    }
  }, [state.currentInput, state.prefixAcceptanceTimeout, state.correctAnswers, state.foundNumbers, state.guessesRemaining, isPrefix, dispatch])

  // Set up global keypress listener
  useEffect(() => {
    document.addEventListener('keypress', handleKeyPress)
    return () => {
      document.removeEventListener('keypress', handleKeyPress)
    }
  }, [handleKeyPress])

  const acceptCorrectNumber = useCallback((number: number) => {
    dispatch({ type: 'ACCEPT_NUMBER', number })
    dispatch({ type: 'SET_INPUT', input: '' })
    setDisplayFeedback('correct')

    setTimeout(() => setDisplayFeedback('neutral'), 500)

    // Auto-finish if all found
    if (state.foundNumbers.length + 1 === state.correctAnswers.length) {
      setTimeout(() => dispatch({ type: 'SHOW_RESULTS' }), 1000)
    }
  }, [dispatch, state.foundNumbers.length, state.correctAnswers.length])

  const handleIncorrectGuess = useCallback(() => {
    const wrongNumber = parseInt(state.currentInput)
    if (!isNaN(wrongNumber)) {
      dispatch({ type: 'ADD_WRONG_GUESS_ANIMATION', number: wrongNumber })
      // Clear wrong guess animations after explosion
      setTimeout(() => {
        dispatch({ type: 'CLEAR_WRONG_GUESS_ANIMATIONS' })
      }, 1500)
    }

    dispatch({ type: 'REJECT_NUMBER' })
    dispatch({ type: 'SET_INPUT', input: '' })
    setDisplayFeedback('incorrect')

    setTimeout(() => setDisplayFeedback('neutral'), 500)

    // Auto-finish if out of guesses
    if (state.guessesRemaining - 1 === 0) {
      setTimeout(() => dispatch({ type: 'SHOW_RESULTS' }), 1000)
    }
  }, [dispatch, state.guessesRemaining, state.currentInput])

  const hasFoundSome = state.foundNumbers.length > 0
  const hasFoundAll = state.foundNumbers.length === state.correctAnswers.length
  const outOfGuesses = state.guessesRemaining === 0
  const showFinishButtons = hasFoundAll || outOfGuesses || hasFoundSome

  return (
    <div className={css({
      textAlign: 'center',
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start'
    })}>
      <h3 className={css({ marginBottom: '20px', color: 'gray.800' })}>Enter the Numbers You Remember</h3>
      <div className={css({
        display: 'flex',
        justifyContent: 'center',
        gap: '30px',
        marginBottom: '30px',
        padding: '20px',
        background: 'gray.50',
        borderRadius: '12px'
      })}>
        <div className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        })}>
          <span className={css({
            fontSize: '14px',
            color: 'gray.600',
            fontWeight: '500'
          })}>Cards shown:</span>
          <span className={css({
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'gray.800'
          })}>{state.quizCards.length}</span>
        </div>
        <div className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        })}>
          <span className={css({
            fontSize: '14px',
            color: 'gray.600',
            fontWeight: '500'
          })}>Guesses left:</span>
          <span className={css({
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'gray.800'
          })}>{state.guessesRemaining}</span>
        </div>
        <div className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        })}>
          <span className={css({
            fontSize: '14px',
            color: 'gray.600',
            fontWeight: '500'
          })}>Found:</span>
          <span className={css({
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'gray.800'
          })}>{state.foundNumbers.length}</span>
        </div>
      </div>

      <div className={css({
        position: 'relative',
        margin: '24px 0',
        textAlign: 'center'
      })}>
        <div className={css({
          fontSize: '14px',
          color: 'gray.600',
          marginBottom: '12px',
          fontWeight: '500'
        })}>
          {state.guessesRemaining === 0
            ? '🚫 No more guesses available'
            : '⌨️ Type the numbers you remember'
          }
        </div>
        <div
          className={css({
            minHeight: '60px',
            padding: '16px 20px',
            fontSize: '28px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
            fontWeight: '600',
            color: state.guessesRemaining === 0 ? 'gray.500' : 'gray.800',
            letterSpacing: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            background: displayFeedback === 'correct'
              ? 'linear-gradient(45deg, #d4edda, #c3e6cb)'
              : displayFeedback === 'incorrect'
              ? 'linear-gradient(45deg, #f8d7da, #f1b0b7)'
              : state.guessesRemaining === 0
              ? 'gray.200'
              : 'linear-gradient(135deg, #f0f8ff, #e6f3ff)',
            borderRadius: '16px',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '16px',
              padding: '2px',
              background: displayFeedback === 'correct'
                ? 'linear-gradient(45deg, #28a745, #20c997)'
                : displayFeedback === 'incorrect'
                ? 'linear-gradient(45deg, #dc3545, #e74c3c)'
                : state.guessesRemaining === 0
                ? 'linear-gradient(45deg, #6c757d, #adb5bd)'
                : 'linear-gradient(45deg, #007bff, #4dabf7)',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'xor'
            },
            boxShadow: displayFeedback === 'correct'
              ? '0 8px 25px rgba(40, 167, 69, 0.2)'
              : displayFeedback === 'incorrect'
              ? '0 8px 25px rgba(220, 53, 69, 0.2)'
              : '0 6px 20px rgba(0, 123, 255, 0.15)',
            cursor: state.guessesRemaining === 0 ? 'not-allowed' : 'pointer'
          })}
        >
          <span className={css({ opacity: 1, position: 'relative' })}>
            {state.guessesRemaining === 0
              ? '🔒 Game Over'
              : state.currentInput || (
                  <span style={{
                    color: '#74c0fc',
                    opacity: 0.8,
                    fontStyle: 'normal',
                    fontSize: '20px'
                  }}>
                    💭 Think & Type
                  </span>
                )
            }
            {state.currentInput && (
              <span className={css({
                position: 'absolute',
                right: '-8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '2px',
                height: '24px',
                background: '#007bff',
                animation: 'blink 1s infinite'
              })} />
            )}
          </span>
        </div>
      </div>


      {/* Visual card grid showing cards the user was shown */}
      <div className={css({
        marginTop: '16px',
        flex: 1,
        overflow: 'auto',
        minHeight: '0' // Allow flex child to shrink
      })}>
        <CardGrid state={state} />
      </div>

      {/* Wrong guess explosion animations */}
      <div className={css({
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1000
      })}>
        {state.wrongGuessAnimations.map((animation) => (
          <div
            key={animation.id}
            className={css({
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '72px',
              fontWeight: 'bold',
              color: 'red.500',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
              animation: 'explode 1.5s ease-out forwards'
            })}
          >
            {animation.number}
          </div>
        ))}
      </div>

      {showFinishButtons && (
        <div className={css({
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid',
          borderColor: 'gray.200'
        })}>
          <button
            className={css({
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: 'blue.500',
              color: 'white',
              _hover: { background: 'blue.600' }
            })}
            onClick={() => dispatch({ type: 'SHOW_RESULTS' })}
          >
            {hasFoundAll ? 'Finish Quiz' : 'Show Results'}
          </button>
          {hasFoundSome && !hasFoundAll && !outOfGuesses && (
            <button
              className={css({
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: 'gray.500',
                color: 'white',
                _hover: { background: 'gray.600' }
              })}
              onClick={() => dispatch({ type: 'SHOW_RESULTS' })}
            >
              Can't Remember More
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// React component for the results phase
function ResultsPhase({ state, dispatch }: { state: SorobanQuizState; dispatch: React.Dispatch<QuizAction> }) {
  const appConfig = useAbacusConfig()
  const correct = state.foundNumbers.length
  const total = state.correctAnswers.length
  const percentage = Math.round((correct / total) * 100)

  return (
    <div className={css({
      textAlign: 'center',
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start'
    })}>
      <h3 className={css({ marginBottom: '30px', color: 'gray.800' })}>Quiz Results</h3>
      <div className={css({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '30px',
        marginBottom: '30px',
        padding: '20px',
        background: 'gray.50',
        borderRadius: '12px'
      })}>
        <div className={css({
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'linear-gradient(45deg, #007bff, #0056b3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '24px',
          fontWeight: 'bold'
        })}>
          <span>{percentage}%</span>
        </div>
        <div className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        })}>
          <div className={css({
            display: 'flex',
            justifyContent: 'space-between',
            gap: '20px',
            fontSize: '18px'
          })}>
            <span className={css({ fontWeight: '500', color: 'gray.600' })}>Correct:</span>
            <span className={css({ fontWeight: 'bold' })}>{correct}</span>
          </div>
          <div className={css({
            display: 'flex',
            justifyContent: 'space-between',
            gap: '20px',
            fontSize: '18px'
          })}>
            <span className={css({ fontWeight: '500', color: 'gray.600' })}>Total:</span>
            <span className={css({ fontWeight: 'bold' })}>{total}</span>
          </div>
        </div>
      </div>

      {/* Results card grid - reuse CardGrid but with all cards revealed and status indicators */}
      <div className={css({ marginTop: '16px', flex: 1, overflow: 'auto' })}>
        <ResultsCardGrid state={state} />
      </div>

      <div className={css({
        display: 'flex',
        justifyContent: 'center',
        gap: '15px',
        marginTop: '20px'
      })}>
        <button
          className={css({
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: 'green.500',
            color: 'white',
            _hover: { background: 'green.600' }
          })}
          onClick={() => {
            dispatch({ type: 'RESET_QUIZ' })
            const quizCards = generateQuizCards(state.selectedCount, state.selectedDifficulty, appConfig)
            dispatch({ type: 'START_QUIZ', quizCards })
          }}
        >
          Try Again
        </button>
        <button
          className={css({
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: 'gray.500',
            color: 'white',
            _hover: { background: 'gray.600' }
          })}
          onClick={() => dispatch({ type: 'RESET_QUIZ' })}
        >
          Back to Cards
        </button>
      </div>
    </div>
  )
}

// CSS animations that need to be global
const globalAnimations = `
@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
  50% { transform: scale(1.05); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5); }
  100% { transform: scale(1); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
}

@keyframes subtlePageFlash {
  0% { background: linear-gradient(to bottom right, #f0fdf4, #ecfdf5); }
  50% { background: linear-gradient(to bottom right, #dcfce7, #d1fae5); }
  100% { background: linear-gradient(to bottom right, #f0fdf4, #ecfdf5); }
}

@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes explode {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.5);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2) rotate(180deg);
  }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
`

export default function MemoryQuizPage() {
  const [state, dispatch] = useReducer(quizReducer, initialState)

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (state.prefixAcceptanceTimeout) {
        clearTimeout(state.prefixAcceptanceTimeout)
      }
    }
  }, [state.prefixAcceptanceTimeout])

  return (
    <FullscreenGameLayout title="Memory Lightning">
      <style dangerouslySetInnerHTML={{ __html: globalAnimations }} />

      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(to bottom right, #f0fdf4, #eff6ff)',
          padding: '8px',
          height: '100vh',
          overflow: 'auto'
        }}
      >
        <div
          style={{
            maxWidth: '100%',
            margin: '0 auto',
            padding: '0 8px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div className={css({
            textAlign: 'center',
            mb: '4',
            flexShrink: 0
          })}>
            <Link
              href="/games"
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                color: 'gray.600',
                textDecoration: 'none',
                mb: '4',
                _hover: { color: 'gray.800' }
              })}
            >
              ← Back to Games
            </Link>
          </div>

          <div className={css({
            bg: 'white',
            rounded: 'xl',
            shadow: 'xl',
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'gray.200',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '100%'
          })}>
            <div className={css({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto'
            })}>
              {state.gamePhase === 'setup' && <SetupPhase state={state} dispatch={dispatch} />}
              {state.gamePhase === 'display' && <DisplayPhase state={state} dispatch={dispatch} />}
              {state.gamePhase === 'input' && <InputPhase state={state} dispatch={dispatch} />}
              {state.gamePhase === 'results' && <ResultsPhase state={state} dispatch={dispatch} />}
            </div>
          </div>
        </div>
      </div>
    </FullscreenGameLayout>
  )
}