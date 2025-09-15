'use client'

import Link from 'next/link'
import React, { useEffect, useReducer, useRef, useCallback, useMemo, useState } from 'react'
import { css } from '../../../../styled-system/css'
import { TypstSoroban } from '../../../components/TypstSoroban'

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

// Generate quiz cards using ServerSorobanSVG with difficulty-based number ranges
const generateQuizCards = (count: number, difficulty: DifficultyLevel): QuizCard[] => {
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
    svgComponent: <div style={{
      transform: 'scale(2.0)',
      transformOrigin: 'center'
    }}>
      <TypstSoroban
        number={number}
        width="280pt"
        height="360pt"
        enableServerFallback={true}
      />
    </div>,
    element: null
  }))
}

// React component for the setup phase
function SetupPhase({ state, dispatch }: { state: SorobanQuizState; dispatch: React.Dispatch<QuizAction> }) {
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
    const quizCards = generateQuizCards(state.selectedCount, state.selectedDifficulty)
    dispatch({ type: 'START_QUIZ', quizCards })
  }

  return (
    <div className={css({
      textAlign: 'center',
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto'
    })}>
      <h2 className={css({ color: 'gray.700', marginBottom: '10px' })}>🧠 Speed Memory Quiz</h2>
      <p className={css({ color: 'gray.600', marginBottom: '20px' })}>Test your soroban reading skills! Cards will be shown briefly, then you'll enter the numbers you remember.</p>

      <div className={css({ maxWidth: '600px', margin: '0 auto' })}>
        <div className={css({ margin: '20px 0' })}>
          <label className={css({ display: 'block', fontWeight: 'bold', marginBottom: '10px', color: 'gray.600' })}>Difficulty Level:</label>
          <div className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            justifyContent: 'center'
          })}>
            {Object.entries(DIFFICULTY_LEVELS).map(([key, level]) => (
              <button
                key={key}
                type="button"
                className={css({
                  background: state.selectedDifficulty === key ? 'blue.500' : 'white',
                  color: state.selectedDifficulty === key ? 'white' : 'gray.800',
                  border: '2px solid',
                  borderColor: state.selectedDifficulty === key ? 'blue.500' : 'gray.300',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  _hover: {
                    background: state.selectedDifficulty === key ? 'blue.600' : 'gray.50',
                    borderColor: 'blue.400',
                    transform: 'translateY(-1px)'
                  }
                })}
                onClick={() => handleDifficultySelect(key as DifficultyLevel)}
                title={level.description}
              >
                <div className={css({ fontWeight: 'bold', fontSize: '14px' })}>{level.name}</div>
                <div className={css({ fontSize: '11px', opacity: 0.8 })}>{level.description}</div>
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

// React component for the display phase
function DisplayPhase({ state, dispatch }: { state: SorobanQuizState; dispatch: React.Dispatch<QuizAction> }) {
  const [countdown, setCountdown] = useState<string>('')
  const [showCard, setShowCard] = useState(false)
  const [currentCard, setCurrentCard] = useState<QuizCard | null>(null)
  const isProcessingRef = useRef(false)

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
      setCurrentCard(card)

      // Show countdown for first card only
      if (state.currentCardIndex === 0) {
        const counts = ['3', '2', '1', 'GO!']
        for (let i = 0; i < counts.length; i++) {
          setCountdown(counts[i])
          await new Promise(resolve => setTimeout(resolve, 400))
        }
      } else {
        setCountdown('Next')
        await new Promise(resolve => setTimeout(resolve, 150))
      }

      setCountdown('')
      setShowCard(true)
      console.log(`DisplayPhase: Card ${state.currentCardIndex + 1} now visible`)

      // Display card for specified time
      await new Promise(resolve => setTimeout(resolve, state.displayTime * 1000 - 300))

      setShowCard(false)
      console.log(`DisplayPhase: Card ${state.currentCardIndex + 1} hidden, advancing to next`)
      await new Promise(resolve => setTimeout(resolve, 100))

      isProcessingRef.current = false
      dispatch({ type: 'NEXT_CARD' })
    }

    showNextCard()
  }, [state.currentCardIndex, state.displayTime, state.quizCards.length, dispatch])

  return (
    <div className={css({
      textAlign: 'center',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxSizing: 'border-box',
      height: '100%'
    })}>
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

      {countdown && (
        <div className={css({
          fontSize: '3rem',
          fontWeight: 'bold',
          color: countdown === 'GO!' ? 'green.500' : 'blue.500',
          margin: '20px 0',
          textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
          animation: countdown === 'GO!' ? 'pulse 0.3s ease' : undefined
        })}>
          {countdown}
        </div>
      )}

      {showCard && currentCard && (
        <div className={css({
          width: 'min(80vw, 600px)',
          height: 'min(40vh, 350px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          transition: 'transform 0.3s ease',
          '& svg': {
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain'
          }
        })}>
          {currentCard.svgComponent}
        </div>
      )}
    </div>
  )
}

// Visual card grid component
function CardGrid({ state }: { state: SorobanQuizState }) {
  if (state.quizCards.length === 0) return null

  return (
    <div className={css({
      marginTop: '16px',
      padding: '16px',
      background: 'gray.50',
      borderRadius: '12px',
      border: '1px solid',
      borderColor: 'gray.200'
    })}>
      <h4 className={css({
        textAlign: 'center',
        color: 'gray.700',
        marginBottom: '12px',
        fontSize: '16px',
        fontWeight: '600'
      })}>Cards you saw:</h4>
      <div className={css({
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '12px',
        maxWidth: '100%',
        margin: '0 auto'
      })}>
        {state.quizCards.map((card, index) => {
          const isRevealed = state.foundNumbers.includes(card.number)
          return (
            <div
              key={`card-${index}-${card.number}`}
              className={css({
                perspective: '1000px',
                height: '140px'
              })}
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
                  fontWeight: 'bold',
                  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
                  border: '3px solid #5f3dc4'
                })}>
                  <div className={css({ opacity: 0.8 })}>?</div>
                </div>

                {/* Card front (revealed state) - using ServerSorobanSVG */}
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
                    justifyContent: 'center'
                  })}>
                    <div style={{
                      transform: 'scale(2.8)',
                      transformOrigin: 'center'
                    }}>
                      <TypstSoroban
                        number={card.number}
                        width="100pt"
                        height="130pt"
                        enableServerFallback={true}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// React component for the input phase
function InputPhase({ state, dispatch }: { state: SorobanQuizState; dispatch: React.Dispatch<QuizAction> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [displayFeedback, setDisplayFeedback] = useState<'neutral' | 'correct' | 'incorrect'>('neutral')

  const isPrefix = useCallback((input: string, numbers: number[]) => {
    return numbers.some(n => n.toString().startsWith(input) && n.toString() !== input)
  }, [])

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
      if (!isPrefix(newInput, state.correctAnswers)) {
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


      {/* Visual card grid showing cards the user was shown - now more compact */}
      <div className={css({ marginTop: '16px', flex: 1, overflow: 'auto' })}>
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

      <div className={css({ marginTop: '16px' })}>
        <h4 className={css({ marginBottom: '16px', color: 'gray.700' })}>Detailed Results:</h4>
        {state.correctAnswers.map(number => {
          const found = state.foundNumbers.includes(number)
          const status = found ? '✅' : '❌'
          return (
            <div
              key={number}
              className={css({
                margin: '8px 0',
                padding: '8px',
                background: found ? 'green.50' : 'red.50',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                border: '1px solid',
                borderColor: found ? 'green.200' : 'red.200'
              })}
            >
              <span className={css({ fontWeight: '500' })}>{number}</span>
              <span>{status}</span>
            </div>
          )
        })}
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
            const quizCards = generateQuizCards(state.selectedCount, state.selectedDifficulty)
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
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
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
    <>
      <style dangerouslySetInnerHTML={{ __html: globalAnimations }} />

      <div className={css({
        minH: 'screen',
        bg: 'gradient-to-br',
        gradientFrom: 'green.50',
        gradientTo: 'blue.50',
        py: '4',
        height: '100vh',
        overflow: 'auto'
      })}>
        <div className={css({
          maxW: '100%',
          mx: 'auto',
          px: { base: '2', md: '4' },
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        })}>
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
    </>
  )
}