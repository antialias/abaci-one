import { useCallback, useEffect, useState } from 'react'
import { isPrefix } from '@/lib/memory-quiz-utils'
import { useMemoryQuiz } from '../Provider'
import { useViewport } from '@/contexts/ViewportContext'
import { CardGrid } from './CardGrid'

export function InputPhase() {
  const { state, dispatch, acceptNumber, rejectNumber, setInput, showResults } = useMemoryQuiz()
  const viewport = useViewport()
  const [displayFeedback, setDisplayFeedback] = useState<'neutral' | 'correct' | 'incorrect'>(
    'neutral'
  )

  // Use keyboard state from parent state instead of local state
  const { hasPhysicalKeyboard, testingMode, showOnScreenKeyboard } = state

  // Debug: Log state changes and detect what's causing re-renders
  useEffect(() => {
    console.log('🔍 Keyboard state changed:', {
      hasPhysicalKeyboard,
      testingMode,
      showOnScreenKeyboard,
    })
    console.trace('🔍 State change trace:')
  }, [hasPhysicalKeyboard, testingMode, showOnScreenKeyboard])

  // Debug: Monitor for unexpected state resets
  useEffect(() => {
    if (showOnScreenKeyboard) {
      const timer = setTimeout(() => {
        if (!showOnScreenKeyboard) {
          console.error('🚨 Keyboard was unexpectedly hidden!')
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [showOnScreenKeyboard])

  // Detect physical keyboard availability (disabled when testing mode is active)
  useEffect(() => {
    // Skip keyboard detection entirely when testing mode is enabled
    if (testingMode) {
      console.log('🧪 Testing mode enabled - skipping keyboard detection')
      return
    }

    let detectionTimer: NodeJS.Timeout | null = null

    const detectKeyboard = () => {
      // Method 1: Check if device supports keyboard via media queries
      const hasKeyboardSupport =
        window.matchMedia('(pointer: fine)').matches && window.matchMedia('(hover: hover)').matches

      // Method 2: Check if device is likely touch-only
      const isTouchDevice =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

      // Method 3: Check viewport characteristics for mobile devices
      const isMobileViewport = viewport.width <= 768 && viewport.height <= 1024

      // Combined heuristic: assume no physical keyboard if:
      // - It's a touch device AND has mobile viewport AND lacks precise pointer
      const likelyNoKeyboard = isTouchDevice && isMobileViewport && !hasKeyboardSupport

      console.log('⌨️ Keyboard detection result:', !likelyNoKeyboard)
      dispatch({
        type: 'SET_PHYSICAL_KEYBOARD',
        hasKeyboard: !likelyNoKeyboard,
      })
    }

    // Test for actual keyboard input within 3 seconds
    let keyboardDetected = false
    const handleFirstKeyPress = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        console.log('⌨️ Physical keyboard detected via keypress')
        keyboardDetected = true
        dispatch({ type: 'SET_PHYSICAL_KEYBOARD', hasKeyboard: true })
        document.removeEventListener('keypress', handleFirstKeyPress)
        if (detectionTimer) clearTimeout(detectionTimer)
      }
    }

    // Start detection
    document.addEventListener('keypress', handleFirstKeyPress)

    // Fallback to heuristic detection after 3 seconds
    detectionTimer = setTimeout(() => {
      if (!keyboardDetected) {
        console.log('⌨️ Using fallback keyboard detection')
        detectKeyboard()
      }
      document.removeEventListener('keypress', handleFirstKeyPress)
    }, 3000)

    // Initial heuristic detection (but don't commit to it yet)
    const initialDetection = setTimeout(detectKeyboard, 100)

    return () => {
      document.removeEventListener('keypress', handleFirstKeyPress)
      if (detectionTimer) clearTimeout(detectionTimer)
      clearTimeout(initialDetection)
    }
  }, [testingMode, dispatch])

  const acceptCorrectNumber = useCallback(
    (number: number) => {
      acceptNumber?.(number)
      // setInput('') is called inside acceptNumber action creator
      setDisplayFeedback('correct')

      setTimeout(() => setDisplayFeedback('neutral'), 500)

      // Auto-finish if all found
      if (state.foundNumbers.length + 1 === state.correctAnswers.length) {
        setTimeout(() => showResults?.(), 1000)
      }
    },
    [acceptNumber, showResults, state.foundNumbers.length, state.correctAnswers.length]
  )

  const handleIncorrectGuess = useCallback(() => {
    const wrongNumber = parseInt(state.currentInput, 10)
    if (!Number.isNaN(wrongNumber)) {
      dispatch({ type: 'ADD_WRONG_GUESS_ANIMATION', number: wrongNumber })
      // Clear wrong guess animations after explosion
      setTimeout(() => {
        dispatch({ type: 'CLEAR_WRONG_GUESS_ANIMATIONS' })
      }, 1500)
    }

    rejectNumber?.()
    // setInput('') is called inside rejectNumber action creator
    setDisplayFeedback('incorrect')

    setTimeout(() => setDisplayFeedback('neutral'), 500)

    // Auto-finish if out of guesses
    if (state.guessesRemaining - 1 === 0) {
      setTimeout(() => showResults?.(), 1000)
    }
  }, [state.currentInput, dispatch, rejectNumber, showResults, state.guessesRemaining])

  // Simple keyboard event handlers that will be defined after callbacks
  const handleKeyboardInput = useCallback(
    (key: string) => {
      // Handle number input
      if (/^[0-9]$/.test(key)) {
        // Only handle if input phase is active and guesses remain
        if (state.guessesRemaining === 0) return

        // Update input with new key
        const newInput = state.currentInput + key
        setInput?.(newInput)

        // Clear any existing timeout
        if (state.prefixAcceptanceTimeout) {
          clearTimeout(state.prefixAcceptanceTimeout)
          dispatch({ type: 'SET_PREFIX_TIMEOUT', timeout: null })
        }

        setDisplayFeedback('neutral')

        const number = parseInt(newInput, 10)
        if (Number.isNaN(number)) return

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
          const couldBePrefix = state.correctAnswers.some((n) => n.toString().startsWith(newInput))
          const isCompleteWrongNumber = !state.correctAnswers.includes(number) && !couldBePrefix

          // Trigger explosion if:
          // 1. It's a complete wrong number (length >= 2 or can't be a prefix)
          // 2. It's a single digit that can't possibly be a prefix of any target
          if ((newInput.length >= 2 || isCompleteWrongNumber) && state.guessesRemaining > 0) {
            handleIncorrectGuess()
          }
        }
      }
    },
    [
      state.currentInput,
      state.prefixAcceptanceTimeout,
      state.correctAnswers,
      state.foundNumbers,
      state.guessesRemaining,
      dispatch,
      setInput,
      acceptCorrectNumber,
      handleIncorrectGuess,
    ]
  )

  const handleKeyboardBackspace = useCallback(() => {
    if (state.currentInput.length > 0) {
      const newInput = state.currentInput.slice(0, -1)
      setInput?.(newInput)

      // Clear any existing timeout
      if (state.prefixAcceptanceTimeout) {
        clearTimeout(state.prefixAcceptanceTimeout)
        dispatch({ type: 'SET_PREFIX_TIMEOUT', timeout: null })
      }

      setDisplayFeedback('neutral')
    }
  }, [state.currentInput, state.prefixAcceptanceTimeout, dispatch, setInput])

  // Set up global keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle backspace/delete on keydown to prevent repetition
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        handleKeyboardBackspace()
      }
    }

    const handleKeyPressEvent = (e: KeyboardEvent) => {
      // Handle number input
      if (/^[0-9]$/.test(e.key)) {
        handleKeyboardInput(e.key)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keypress', handleKeyPressEvent)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keypress', handleKeyPressEvent)
    }
  }, [handleKeyboardInput, handleKeyboardBackspace])

  const hasFoundSome = state.foundNumbers.length > 0
  const hasFoundAll = state.foundNumbers.length === state.correctAnswers.length
  const outOfGuesses = state.guessesRemaining === 0
  const showFinishButtons = hasFoundAll || outOfGuesses || hasFoundSome

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '12px',
        paddingBottom:
          (hasPhysicalKeyboard === false || testingMode) && state.guessesRemaining > 0
            ? '100px'
            : '12px', // Add space for keyboard
        maxWidth: '800px',
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}
    >
      <h3
        style={{
          marginBottom: '16px',
          color: '#1f2937',
          fontSize: '18px',
          fontWeight: 600,
        }}
      >
        Enter the Numbers You Remember
      </h3>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          marginBottom: '20px',
          padding: '16px',
          background: '#f9fafb',
          borderRadius: '8px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: '80px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: 500,
            }}
          >
            Cards shown:
          </span>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#1f2937',
            }}
          >
            {state.quizCards.length}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: '80px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: 500,
            }}
          >
            Guesses left:
          </span>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#1f2937',
            }}
          >
            {state.guessesRemaining}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: '80px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: 500,
            }}
          >
            Found:
          </span>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#1f2937',
            }}
          >
            {state.foundNumbers.length}
          </span>
        </div>
      </div>

      {/* Live Scoreboard - Competitive Mode Only */}
      {state.playMode === 'competitive' &&
        state.activePlayers &&
        state.activePlayers.length > 1 && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              borderRadius: '8px',
              border: '2px solid #f59e0b',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#92400e',
                marginBottom: '8px',
                textAlign: 'center',
              }}
            >
              🏆 LIVE SCOREBOARD
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {(() => {
                // Group players by userId
                const userTeams = new Map<
                  string,
                  {
                    userId: string
                    players: any[]
                    score: { correct: number; incorrect: number }
                  }
                >()

                console.log('📊 [InputPhase] Building scoreboard:', {
                  activePlayers: state.activePlayers,
                  playerMetadata: state.playerMetadata,
                  playerScores: state.playerScores,
                })

                for (const playerId of state.activePlayers) {
                  const metadata = state.playerMetadata?.[playerId]
                  const userId = metadata?.userId
                  console.log('📊 [InputPhase] Processing player for scoreboard:', {
                    playerId,
                    metadata,
                    userId,
                  })
                  if (!userId) continue

                  if (!userTeams.has(userId)) {
                    userTeams.set(userId, {
                      userId,
                      players: [],
                      score: state.playerScores?.[userId] || {
                        correct: 0,
                        incorrect: 0,
                      },
                    })
                  }
                  userTeams.get(userId)!.players.push(metadata)
                }

                console.log('📊 [InputPhase] UserTeams created:', {
                  count: userTeams.size,
                  teams: Array.from(userTeams.entries()),
                })

                // Sort teams by score
                return Array.from(userTeams.values())
                  .sort((a, b) => {
                    const aScore = a.score.correct - a.score.incorrect * 0.5
                    const bScore = b.score.correct - b.score.incorrect * 0.5
                    return bScore - aScore
                  })
                  .map((team, index) => {
                    const netScore = team.score.correct - team.score.incorrect * 0.5
                    return (
                      <div
                        key={team.userId}
                        style={{
                          padding: '10px 12px',
                          background: index === 0 ? '#fef3c7' : 'white',
                          borderRadius: '8px',
                          border: index === 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                        }}
                      >
                        {/* Team header with rank and stats */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span style={{ fontSize: '18px' }}>
                              {index === 0 ? '👑' : `${index + 1}.`}
                            </span>
                            <span
                              style={{
                                fontWeight: 'bold',
                                fontSize: '16px',
                                color: '#1f2937',
                              }}
                            >
                              Score: {netScore.toFixed(1)}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              fontSize: '14px',
                            }}
                          >
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                              ✓{team.score.correct}
                            </span>
                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                              ✗{team.score.incorrect}
                            </span>
                          </div>
                        </div>
                        {/* Players list */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            paddingLeft: '26px',
                          }}
                        >
                          {team.players.map((player, i) => (
                            <div
                              key={i}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '13px',
                              }}
                            >
                              <span style={{ fontSize: '16px' }}>{player?.emoji || '🎮'}</span>
                              <span
                                style={{
                                  color: '#1f2937',
                                  fontWeight: 500,
                                }}
                              >
                                {player?.name || `Player ${i + 1}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
              })()}
            </div>
          </div>
        )}

      <div
        style={{
          position: 'relative',
          margin: '16px 0',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            color: '#6b7280',
            marginBottom: '8px',
            fontWeight: 500,
          }}
        >
          {state.guessesRemaining === 0
            ? '🚫 No more guesses available'
            : '⌨️ Type the numbers you remember'}
        </div>

        {/* Testing control - remove in production */}
        <div
          style={{
            fontSize: '10px',
            color: '#9ca3af',
            marginBottom: '4px',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              justifyContent: 'center',
            }}
          >
            <input
              type="checkbox"
              checked={testingMode}
              onChange={(e) =>
                dispatch({
                  type: 'SET_TESTING_MODE',
                  enabled: e.target.checked,
                })
              }
            />
            Test on-screen keyboard (for demo)
          </label>
          <div style={{ fontSize: '9px', opacity: 0.7 }}>
            Keyboard detected:{' '}
            {hasPhysicalKeyboard === null ? 'detecting...' : hasPhysicalKeyboard ? 'yes' : 'no'}
          </div>
        </div>
        <div
          style={{
            minHeight: '50px',
            padding: '12px 16px',
            fontSize: '22px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
            fontWeight: 600,
            color: state.guessesRemaining === 0 ? '#6b7280' : '#1f2937',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            background:
              displayFeedback === 'correct'
                ? 'linear-gradient(45deg, #d4edda, #c3e6cb)'
                : displayFeedback === 'incorrect'
                  ? 'linear-gradient(45deg, #f8d7da, #f1b0b7)'
                  : state.guessesRemaining === 0
                    ? '#e5e7eb'
                    : 'linear-gradient(135deg, #f0f8ff, #e6f3ff)',
            borderRadius: '12px',
            position: 'relative',
            border: '2px solid',
            borderColor:
              displayFeedback === 'correct'
                ? '#28a745'
                : displayFeedback === 'incorrect'
                  ? '#dc3545'
                  : state.guessesRemaining === 0
                    ? '#9ca3af'
                    : '#3b82f6',
            boxShadow:
              displayFeedback === 'correct'
                ? '0 4px 12px rgba(40, 167, 69, 0.2)'
                : displayFeedback === 'incorrect'
                  ? '0 4px 12px rgba(220, 53, 69, 0.2)'
                  : '0 4px 12px rgba(59, 130, 246, 0.15)',
            cursor: state.guessesRemaining === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <span style={{ opacity: 1, position: 'relative' }}>
            {state.guessesRemaining === 0
              ? '🔒 Game Over'
              : state.currentInput || (
                  <span
                    style={{
                      color: '#74c0fc',
                      opacity: 0.8,
                      fontStyle: 'normal',
                      fontSize: '20px',
                    }}
                  >
                    💭 Think & Type
                  </span>
                )}
            {state.currentInput && (
              <span
                style={{
                  position: 'absolute',
                  right: '-8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '2px',
                  height: '20px',
                  background: '#3b82f6',
                  animation: 'blink 1s infinite',
                }}
              />
            )}
          </span>
        </div>
      </div>

      {/* Visual card grid showing cards the user was shown */}
      <div
        style={{
          marginTop: '12px',
          flex: 1,
          overflow: 'auto',
          minHeight: '0',
        }}
      >
        <CardGrid state={state} />
      </div>

      {/* Wrong guess explosion animations */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
      >
        {state.wrongGuessAnimations.map((animation) => (
          <div
            key={animation.id}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#ef4444',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
              animation: 'explode 1.5s ease-out forwards',
            }}
          >
            {animation.number}
          </div>
        ))}
      </div>

      {/* Simple fixed keyboard bar - appears when needed, no hiding of game elements */}
      {(hasPhysicalKeyboard === false || testingMode) && state.guessesRemaining > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            borderTop: '2px solid #3b82f6',
            padding: '12px',
            zIndex: 1000,
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit) => (
            <button
              key={digit}
              style={{
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                background: 'white',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#1f2937',
                cursor: 'pointer',
                minWidth: '50px',
                minHeight: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.15s ease',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)'
                e.currentTarget.style.background = '#f3f4f6'
                e.currentTarget.style.borderColor = '#3b82f6'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.background = 'white'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.background = 'white'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
              onClick={() => handleKeyboardInput(digit.toString())}
            >
              {digit}
            </button>
          ))}
          <button
            style={{
              padding: '12px 16px',
              border: '2px solid #dc2626',
              borderRadius: '8px',
              background: state.currentInput.length > 0 ? '#fef2f2' : '#f9fafb',
              fontSize: '14px',
              fontWeight: 'bold',
              color: state.currentInput.length > 0 ? '#dc2626' : '#9ca3af',
              cursor: state.currentInput.length > 0 ? 'pointer' : 'not-allowed',
              minWidth: '70px',
              minHeight: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
            disabled={state.currentInput.length === 0}
            onClick={handleKeyboardBackspace}
          >
            ⌫
          </button>
        </div>
      )}

      {showFinishButtons && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e7eb',
            flexWrap: 'wrap',
          }}
        >
          <button
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: '#3b82f6',
              color: 'white',
              minWidth: '120px',
            }}
            onClick={() => showResults?.()}
          >
            {hasFoundAll ? 'Finish Quiz' : 'Show Results'}
          </button>
          {hasFoundSome && !hasFoundAll && !outOfGuesses && (
            <button
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: '#6b7280',
                color: 'white',
                minWidth: '120px',
              }}
              onClick={() => showResults?.()}
            >
              Can't Remember More
            </button>
          )}
        </div>
      )}
    </div>
  )
}
