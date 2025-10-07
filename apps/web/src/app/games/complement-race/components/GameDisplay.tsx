'use client'

import { useEffect, useState } from 'react'
import { useComplementRace } from '../context/ComplementRaceContext'
import { useAdaptiveDifficulty } from '../hooks/useAdaptiveDifficulty'
import { useAIRacers } from '../hooks/useAIRacers'
import { useSoundEffects } from '../hooks/useSoundEffects'
import { useSteamJourney } from '../hooks/useSteamJourney'
import { generatePassengers } from '../lib/passengerGenerator'
import { AbacusTarget } from './AbacusTarget'
import { CircularTrack } from './RaceTrack/CircularTrack'
import { LinearTrack } from './RaceTrack/LinearTrack'
import { SteamTrainJourney } from './RaceTrack/SteamTrainJourney'
import { RouteCelebration } from './RouteCelebration'

type FeedbackAnimation = 'correct' | 'incorrect' | null

export function GameDisplay() {
  const { state, dispatch } = useComplementRace()
  useAIRacers() // Activate AI racer updates (not used in sprint mode)
  const { trackPerformance, getAdaptiveFeedbackMessage } = useAdaptiveDifficulty()
  const { boostMomentum } = useSteamJourney()
  const { playSound } = useSoundEffects()
  const [feedbackAnimation, setFeedbackAnimation] = useState<FeedbackAnimation>(null)

  // Clear feedback animation after it plays (line 1996, 2001)
  useEffect(() => {
    if (feedbackAnimation) {
      const timer = setTimeout(() => {
        setFeedbackAnimation(null)
      }, 500) // Match animation duration
      return () => clearTimeout(timer)
    }
  }, [feedbackAnimation])

  // Show adaptive feedback with auto-hide
  useEffect(() => {
    if (state.adaptiveFeedback) {
      const timer = setTimeout(() => {
        dispatch({ type: 'CLEAR_ADAPTIVE_FEEDBACK' })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [state.adaptiveFeedback, dispatch])

  // Check for finish line (player reaches race goal) - only for practice mode
  useEffect(() => {
    if (
      state.correctAnswers >= state.raceGoal &&
      state.isGameActive &&
      state.style === 'practice'
    ) {
      // Play celebration sound (line 14182)
      playSound('celebration')
      // End the game
      dispatch({ type: 'END_RACE' })
      // Show results after a short delay
      setTimeout(() => {
        dispatch({ type: 'SHOW_RESULTS' })
      }, 1500)
    }
  }, [state.correctAnswers, state.raceGoal, state.isGameActive, state.style, dispatch, playSound])

  // For survival mode (endless circuit), track laps but never end
  // For sprint mode (steam sprint), end after 60 seconds (will implement later)

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only process number keys
      if (/^[0-9]$/.test(e.key)) {
        const newInput = state.currentInput + e.key
        dispatch({ type: 'UPDATE_INPUT', input: newInput })

        // Check if answer is complete
        if (state.currentQuestion) {
          const answer = parseInt(newInput, 10)
          const correctAnswer = state.currentQuestion.correctAnswer

          // If we have enough digits to match the answer, submit
          if (newInput.length >= correctAnswer.toString().length) {
            const responseTime = Date.now() - state.questionStartTime
            const isCorrect = answer === correctAnswer
            const pairKey = `${state.currentQuestion.number}_${state.currentQuestion.correctAnswer}_${state.currentQuestion.targetSum}`

            if (isCorrect) {
              // Correct answer
              dispatch({ type: 'SUBMIT_ANSWER', answer })
              trackPerformance(true, responseTime)

              // Trigger correct answer animation (line 1996)
              setFeedbackAnimation('correct')

              // Play appropriate sound based on performance (from web_generator.py lines 11530-11542)
              const newStreak = state.streak + 1
              if (newStreak > 0 && newStreak % 5 === 0) {
                // Epic streak sound for every 5th correct answer
                playSound('streak')
              } else if (responseTime < 800) {
                // Whoosh sound for very fast responses (under 800ms)
                playSound('whoosh')
              } else if (responseTime < 1200 && state.streak >= 3) {
                // Combo sound for rapid answers while on a streak
                playSound('combo')
              } else {
                // Regular correct sound
                playSound('correct')
              }

              // Boost momentum for sprint mode
              if (state.style === 'sprint') {
                boostMomentum()

                // Play train whistle for milestones in sprint mode (line 13222-13235)
                if (newStreak >= 5 && newStreak % 3 === 0) {
                  // Major milestone - play train whistle
                  setTimeout(() => {
                    playSound('train_whistle', 0.4)
                  }, 200)
                } else if (state.momentum >= 90) {
                  // High momentum celebration - occasional whistle
                  if (Math.random() < 0.3) {
                    setTimeout(() => {
                      playSound('train_whistle', 0.25)
                    }, 150)
                  }
                }
              }

              // Show adaptive feedback
              const feedback = getAdaptiveFeedbackMessage(pairKey, true, responseTime)
              if (feedback) {
                dispatch({ type: 'SHOW_ADAPTIVE_FEEDBACK', feedback })
              }

              dispatch({ type: 'NEXT_QUESTION' })
            } else {
              // Incorrect answer
              trackPerformance(false, responseTime)

              // Trigger incorrect answer animation (line 2001)
              setFeedbackAnimation('incorrect')

              // Play incorrect sound (from web_generator.py line 11589)
              playSound('incorrect')

              // Show adaptive feedback
              const feedback = getAdaptiveFeedbackMessage(pairKey, false, responseTime)
              if (feedback) {
                dispatch({ type: 'SHOW_ADAPTIVE_FEEDBACK', feedback })
              }

              dispatch({ type: 'UPDATE_INPUT', input: '' })
            }
          }
        }
      } else if (e.key === 'Backspace') {
        dispatch({ type: 'UPDATE_INPUT', input: state.currentInput.slice(0, -1) })
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [
    state.currentInput,
    state.currentQuestion,
    state.questionStartTime,
    state.style,
    state.streak,
    dispatch,
    trackPerformance,
    getAdaptiveFeedbackMessage,
    boostMomentum,
    playSound,
    state.momentum,
  ])

  // Handle route celebration continue
  const handleContinueToNextRoute = () => {
    const nextRoute = state.currentRoute + 1

    // Start new route (this also hides celebration)
    dispatch({
      type: 'START_NEW_ROUTE',
      routeNumber: nextRoute,
      stations: state.stations, // Keep same stations for now
    })

    // Generate new passengers
    const newPassengers = generatePassengers(state.stations)
    dispatch({ type: 'GENERATE_PASSENGERS', passengers: newPassengers })
  }

  if (!state.currentQuestion) return null

  return (
    <div
      data-component="game-display"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {/* Adaptive Feedback */}
      {state.adaptiveFeedback && (
        <div
          data-component="adaptive-feedback"
          style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
            fontSize: '16px',
            fontWeight: 'bold',
            zIndex: 1000,
            animation: 'slideDown 0.3s ease-out',
            maxWidth: '600px',
            textAlign: 'center',
          }}
        >
          {state.adaptiveFeedback.message}
        </div>
      )}

      {/* Stats Header - constrained width, hidden for sprint mode */}
      {state.style !== 'sprint' && (
        <div
          data-component="stats-container"
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%',
            padding: '0 20px',
            marginTop: '10px',
          }}
        >
          <div
            data-component="stats-header"
            style={{
              display: 'flex',
              justifyContent: 'space-around',
              marginBottom: '10px',
              background: 'white',
              borderRadius: '12px',
              padding: '10px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div data-stat="score" style={{ textAlign: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>Score</div>
              <div style={{ fontWeight: 'bold', fontSize: '24px', color: '#3b82f6' }}>
                {state.score}
              </div>
            </div>
            <div data-stat="streak" style={{ textAlign: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>Streak</div>
              <div style={{ fontWeight: 'bold', fontSize: '24px', color: '#10b981' }}>
                {state.streak} 🔥
              </div>
            </div>
            <div data-stat="progress" style={{ textAlign: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>
                Progress
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '24px', color: '#f59e0b' }}>
                {state.correctAnswers}/{state.raceGoal}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Race Track - full width, break out of padding */}
      <div
        data-component="track-container"
        style={{
          width: '100vw',
          position: 'relative',
          left: '50%',
          right: '50%',
          marginLeft: '-50vw',
          marginRight: '-50vw',
          padding: state.style === 'sprint' ? '0' : '0 20px',
          display: 'flex',
          justifyContent: state.style === 'sprint' ? 'stretch' : 'center',
          background: 'transparent',
          flex: state.style === 'sprint' ? 1 : 'initial',
          minHeight: state.style === 'sprint' ? 0 : 'initial',
        }}
      >
        {state.style === 'survival' ? (
          <CircularTrack
            playerProgress={state.correctAnswers}
            playerLap={state.playerLap}
            aiRacers={state.aiRacers}
            aiLaps={state.aiLaps}
          />
        ) : state.style === 'sprint' ? (
          <SteamTrainJourney
            momentum={state.momentum}
            trainPosition={state.trainPosition}
            pressure={state.pressure}
            elapsedTime={state.elapsedTime}
            currentQuestion={state.currentQuestion}
            currentInput={state.currentInput}
          />
        ) : (
          <LinearTrack
            playerProgress={state.correctAnswers}
            aiRacers={state.aiRacers}
            raceGoal={state.raceGoal}
            showFinishLine={true}
          />
        )}
      </div>

      {/* Question Display - only for non-sprint modes */}
      {state.style !== 'sprint' && (
        <div
          data-component="question-container"
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%',
            padding: '0 20px',
            display: 'flex',
            justifyContent: 'center',
            marginTop: '20px',
          }}
        >
          <div
            data-component="question-display"
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              borderRadius: '24px',
              padding: '28px 50px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.3), 0 0 0 5px rgba(59, 130, 246, 0.4)',
              backdropFilter: 'blur(12px)',
              border: '4px solid rgba(255, 255, 255, 0.95)',
            }}
          >
            {/* Complement equation as main focus */}
            <div
              data-element="question-equation"
              style={{
                fontSize: '96px',
                fontWeight: 'bold',
                color: '#1f2937',
                lineHeight: '1.1',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: 'white',
                  padding: '12px 32px',
                  borderRadius: '16px',
                  minWidth: '140px',
                  display: 'inline-block',
                  textShadow: '0 3px 10px rgba(0, 0, 0, 0.3)',
                }}
              >
                {state.currentInput || '?'}
              </span>
              <span style={{ color: '#6b7280' }}>+</span>
              {state.currentQuestion.showAsAbacus ? (
                <div
                  style={{
                    transform: 'scale(2.4) translateY(8%)',
                    transformOrigin: 'center center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AbacusTarget number={state.currentQuestion.number} />
                </div>
              ) : (
                <span>{state.currentQuestion.number}</span>
              )}
              <span style={{ color: '#6b7280' }}>=</span>
              <span style={{ color: '#10b981' }}>{state.currentQuestion.targetSum}</span>
            </div>
          </div>
        </div>
      )}

      {/* Route Celebration Modal */}
      {state.showRouteCelebration && state.style === 'sprint' && (
        <RouteCelebration
          completedRouteNumber={state.currentRoute}
          nextRouteNumber={state.currentRoute + 1}
          onContinue={handleContinueToNextRoute}
        />
      )}
    </div>
  )
}
