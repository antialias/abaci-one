'use client'

import Link from 'next/link'
import React, { useEffect, useReducer, useRef, useCallback, useMemo, useState } from 'react'
import { css } from '../../../../styled-system/css'
import { ServerSorobanSVG } from '../../../components/ServerSorobanSVG'

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
    svgComponent: <ServerSorobanSVG
      number={number}
      colorScheme="place-value"
      width={280}
      height={360}
    />,
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
    <div className="quiz-section">
      <h2>🧠 Speed Memory Quiz</h2>
      <p>Test your soroban reading skills! Cards will be shown briefly, then you'll enter the numbers you remember.</p>

      <div className="quiz-controls">
        <div className="control-group">
          <label>Difficulty Level:</label>
          <div className="difficulty-buttons">
            {Object.entries(DIFFICULTY_LEVELS).map(([key, level]) => (
              <button
                key={key}
                type="button"
                className={`difficulty-btn ${state.selectedDifficulty === key ? 'active' : ''}`}
                onClick={() => handleDifficultySelect(key as DifficultyLevel)}
                title={level.description}
              >
                <div className="difficulty-name">{level.name}</div>
                <div className="difficulty-range">{level.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>Cards to Quiz:</label>
          <div className="count-buttons">
            {[2, 5, 8, 12, 15].map(count => (
              <button
                key={count}
                type="button"
                className={`count-btn ${state.selectedCount === count ? 'active' : ''}`}
                onClick={() => handleCountSelect(count)}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>Display Time per Card:</label>
          <div className="slider-container">
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={state.displayTime}
              onChange={(e) => handleTimeChange(parseFloat(e.target.value))}
            />
            <span className="slider-value">{state.displayTime.toFixed(1)}s</span>
          </div>
        </div>

        <button className="quiz-start-btn" onClick={handleStartQuiz}>
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
    <div className="quiz-game">
      <div className="quiz-header">
        <div className="quiz-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="progress-text">
            Card {state.currentCardIndex + 1} of {state.quizCards.length}
          </span>
        </div>
        <button
          className="end-game-btn"
          onClick={() => dispatch({ type: 'RESET_QUIZ' })}
        >
          End Quiz
        </button>
      </div>

      {countdown && (
        <div className={`countdown ${countdown === 'GO!' ? 'go' : ''}`}>
          {countdown}
        </div>
      )}

      {showCard && currentCard && (
        <div className="quiz-flashcard">
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
    <div className="card-grid">
      <h4 className="card-grid-title">Cards shown to you:</h4>
      <div className="card-grid-container">
        {state.quizCards.map((card, index) => {
          const isRevealed = state.foundNumbers.includes(card.number)
          return (
            <div
              key={`card-${index}-${card.number}`}
              className={`memory-card ${isRevealed ? 'revealed' : 'hidden'}`}
            >
              <div className="card-inner">
                {/* Card back (hidden state) */}
                <div className="card-back">
                  <div className="card-pattern">?</div>
                </div>

                {/* Card front (revealed state) - using ServerSorobanSVG */}
                <div className="card-front">
                  <div className="card-abacus">
                    <ServerSorobanSVG
                      number={card.number}
                      width={120}
                      height={160}
                      colorScheme="place-value"
                      hideInactiveBeads={false}
                    />
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
    <div className="quiz-input">
      <h3>Enter the Numbers You Remember</h3>
      <div className="quiz-stats">
        <div className="stats-item">
          <span className="stats-label">Cards shown:</span>
          <span>{state.quizCards.length}</span>
        </div>
        <div className="stats-item">
          <span className="stats-label">Guesses left:</span>
          <span>{state.guessesRemaining}</span>
        </div>
        <div className="stats-item">
          <span className="stats-label">Found:</span>
          <span>{state.foundNumbers.length}</span>
        </div>
      </div>

      <div className="smart-input-container">
        <div className="smart-input-prompt">
          {state.guessesRemaining === 0
            ? 'Out of guesses!'
            : 'Just start typing numbers on your keyboard:'
          }
        </div>
        <div
          className={`number-display ${displayFeedback} ${state.guessesRemaining === 0 ? 'disabled' : ''}`}
        >
          <span className="current-typing">
            {state.guessesRemaining === 0
              ? 'No more guesses'
              : state.currentInput || (
                  <span style={{ color: '#6c757d', opacity: 0.6, fontStyle: 'italic' }}>
                    Start typing...
                  </span>
                )
            }
          </span>
        </div>
      </div>

      <div className="found-numbers">
        {state.foundNumbers.map((number, index) => (
          <span key={`${number}-${index}`} className="found-number">
            {number}
          </span>
        ))}
      </div>

      {/* Visual card grid showing cards the user was shown */}
      <CardGrid state={state} />

      {/* Wrong guess explosion animations */}
      <div className="wrong-guess-explosions">
        {state.wrongGuessAnimations.map((animation) => (
          <div key={animation.id} className="exploding-number">
            {animation.number}
          </div>
        ))}
      </div>

      {showFinishButtons && (
        <div className="quiz-finish-buttons">
          <button
            className="finish-btn"
            onClick={() => dispatch({ type: 'SHOW_RESULTS' })}
          >
            {hasFoundAll ? 'Finish Quiz' : 'Show Results'}
          </button>
          {hasFoundSome && !hasFoundAll && !outOfGuesses && (
            <button
              className="give-up-btn"
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
    <div className="quiz-results">
      <h3>Quiz Results</h3>
      <div className="score-display">
        <div className="score-circle">
          <span>{percentage}%</span>
        </div>
        <div className="score-details">
          <div className="score-item">
            <span className="score-label">Correct:</span>
            <span>{correct}</span>
          </div>
          <div className="score-item">
            <span className="score-label">Total:</span>
            <span>{total}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <h4>Detailed Results:</h4>
        {state.correctAnswers.map(number => {
          const found = state.foundNumbers.includes(number)
          const status = found ? '✅' : '❌'
          const color = found ? '#d4edda' : '#f8d7da'
          return (
            <div
              key={number}
              style={{
                margin: '8px 0',
                padding: '8px',
                background: color,
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span>{number}</span>
              <span>{status}</span>
            </div>
          )
        })}
      </div>

      <div className="results-actions">
        <button
          className="retry-btn"
          onClick={() => {
            dispatch({ type: 'RESET_QUIZ' })
            const quizCards = generateQuizCards(state.selectedCount, state.selectedDifficulty)
            dispatch({ type: 'START_QUIZ', quizCards })
          }}
        >
          Try Again
        </button>
        <button
          className="back-btn"
          onClick={() => dispatch({ type: 'RESET_QUIZ' })}
        >
          Back to Cards
        </button>
      </div>
    </div>
  )
}

const originalGameStyles = `
/* Original styles from web_generator.py template */
.quiz-section {
  text-align: center;
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.quiz-section h2 {
  color: #333;
  margin-bottom: 10px;
}

.quiz-controls {
  max-width: 600px;
  margin: 0 auto;
}

.control-group {
  margin: 20px 0;
}

.control-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 10px;
  color: #555;
}

.count-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.count-btn {
  background: white;
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 10px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
}

.count-btn:hover {
  background: #f0f0f0;
  border-color: #4a90e2;
}

.count-btn.active {
  background: #4a90e2;
  color: white;
  border-color: #4a90e2;
}

.difficulty-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  justify-content: center;
}

.difficulty-btn {
  background: white;
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.difficulty-btn:hover {
  background: #f0f0f0;
  border-color: #4a90e2;
  transform: translateY(-1px);
}

.difficulty-btn.active {
  background: #4a90e2;
  color: white;
  border-color: #4a90e2;
}

.difficulty-name {
  font-weight: bold;
  font-size: 14px;
}

.difficulty-range {
  font-size: 11px;
  opacity: 0.8;
}

.slider-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.slider-container input[type="range"] {
  flex: 1;
  max-width: 300px;
}

.slider-value {
  font-weight: bold;
  color: #4a90e2;
  min-width: 50px;
}

.quiz-start-btn {
  background: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 15px 30px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s ease;
  margin-top: 20px;
}

.quiz-start-btn:hover {
  background: #218838;
}

/* Quiz Game Area */
.quiz-game {
  text-align: center;
  padding: 40px 20px;
}

.quiz-progress {
  margin-bottom: 30px;
}

.progress-bar {
  width: 100%;
  height: 10px;
  background: #e9ecef;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  border-radius: 5px;
  width: 0%;
  transition: width 0.5s ease;
}

.progress-text {
  font-size: 16px;
  font-weight: bold;
  color: #495057;
}

.end-game-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.end-game-btn:hover {
  background: #c82333;
}

.quiz-flashcard {
  width: min(85vw, 700px);
  height: min(50vh, 400px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  transition: transform 0.3s ease;
}

#quiz-game {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
}

.quiz-flashcard svg {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.countdown {
  font-size: 3rem;
  font-weight: bold;
  color: #007bff;
  margin: 20px 0;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
}

.countdown.go {
  color: #28a745;
  animation: pulse 0.3s ease;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* Quiz Input */
.quiz-input {
  text-align: center;
  padding: 40px 20px;
  max-width: 700px;
  margin: 0 auto;
}

.quiz-stats {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
}

.stats-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stats-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.stats-item span:last-child {
  font-size: 24px;
  font-weight: bold;
  color: #2c5f76;
}

.smart-input-container {
  position: relative;
  margin: 40px 0;
  text-align: center;
}

.smart-input-prompt {
  font-size: 16px;
  color: #7a8695;
  margin-bottom: 15px;
  font-weight: normal;
}

.number-display {
  min-height: 80px;
  padding: 24px;
  font-size: 36px;
  font-family: 'Courier New', 'Monaco', monospace;
  text-align: center;
  font-weight: bold;
  color: #2c3e50;
  letter-spacing: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border: 3px solid #adb5bd;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  position: relative;
}

.number-display .current-typing {
  opacity: 1;
}

.number-display.correct {
  background: linear-gradient(45deg, #d4edda, #c3e6cb);
  border: 2px solid #28a745;
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(40, 167, 69, 0.3);
}

.number-display.incorrect {
  background: linear-gradient(45deg, #f8d7da, #f1b0b7);
  border: 2px solid #dc3545;
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(220, 53, 69, 0.3);
}

.number-display.disabled {
  background: #e9ecef;
  border: 2px solid #6c757d;
  color: #6c757d;
  cursor: not-allowed;
}

.found-numbers {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin: 20px 0;
  min-height: 60px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.found-number {
  background: #28a745;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 18px;
  animation: fadeInScale 0.3s ease;
}

@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

.quiz-finish-buttons {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
}

.finish-btn, .give-up-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.finish-btn {
  background: #007bff;
  color: white;
}

.finish-btn:hover {
  background: #0056b3;
}

.give-up-btn {
  background: #6c757d;
  color: white;
}

.give-up-btn:hover {
  background: #545b62;
}

/* Quiz Results */
.quiz-results {
  text-align: center;
  padding: 40px 20px;
  max-width: 700px;
  margin: 0 auto;
}

.score-display {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 30px;
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
}

.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(45deg, #007bff, #0056b3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  font-weight: bold;
}

.score-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.score-item {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  font-size: 18px;
}

.score-label {
  font-weight: 500;
  color: #666;
}

.results-actions {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
}

.retry-btn, .back-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-btn {
  background: #28a745;
  color: white;
}

.retry-btn:hover {
  background: #218838;
}

.back-btn {
  background: #6c757d;
  color: white;
}

.back-btn:hover {
  background: #545b62;
}

.hidden {
  display: none !important;
}

/* Card Grid Styles */
.card-grid {
  margin-top: 32px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px solid #e9ecef;
}

.card-grid-title {
  text-align: center;
  color: #495057;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 600;
}

.card-grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  max-width: 800px;
  margin: 0 auto;
}

.memory-card {
  perspective: 1000px;
  height: 180px;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.8s;
  transform-style: preserve-3d;
}

.memory-card.revealed .card-inner {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.card-back {
  background: linear-gradient(135deg, #6c5ce7, #a29bfe);
  color: white;
  font-size: 48px;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  border: 3px solid #5f3dc4;
}

.card-front {
  background: white;
  border: 3px solid #28a745;
  transform: rotateY(180deg);
}

.card-abacus {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-pattern {
  opacity: 0.8;
}

/* Wrong Guess Explosion Animations */
.wrong-guess-explosions {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 1000;
}

.exploding-number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 72px;
  font-weight: bold;
  color: #dc3545;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  animation: explode 1.5s ease-out forwards;
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
      <style dangerouslySetInnerHTML={{ __html: originalGameStyles }} />

      <div className={css({
        minH: 'screen',
        bg: 'gradient-to-br',
        gradientFrom: 'green.50',
        gradientTo: 'blue.50',
        py: '4'
      })}>
        <div className={css({ maxW: '6xl', mx: 'auto', px: { base: '4', md: '6' } })}>
          <div className={css({ textAlign: 'center', mb: '6' })}>
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
            borderColor: 'gray.200'
          })}>
            {state.gamePhase === 'setup' && <SetupPhase state={state} dispatch={dispatch} />}
            {state.gamePhase === 'display' && <DisplayPhase state={state} dispatch={dispatch} />}
            {state.gamePhase === 'input' && <InputPhase state={state} dispatch={dispatch} />}
            {state.gamePhase === 'results' && <ResultsPhase state={state} dispatch={dispatch} />}
          </div>
        </div>
      </div>
    </>
  )
}