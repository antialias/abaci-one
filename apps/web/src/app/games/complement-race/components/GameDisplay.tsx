'use client'

import { useEffect } from 'react'
import { useComplementRace } from '../context/ComplementRaceContext'
import { useAIRacers } from '../hooks/useAIRacers'
import { useAdaptiveDifficulty } from '../hooks/useAdaptiveDifficulty'
import { useSteamJourney } from '../hooks/useSteamJourney'
import { LinearTrack } from './RaceTrack/LinearTrack'
import { CircularTrack } from './RaceTrack/CircularTrack'
import { SteamTrainJourney } from './RaceTrack/SteamTrainJourney'
import { RouteCelebration } from './RouteCelebration'
import { generatePassengers } from '../lib/passengerGenerator'

export function GameDisplay() {
  const { state, dispatch } = useComplementRace()
  useAIRacers() // Activate AI racer updates (not used in sprint mode)
  const { trackPerformance, getAdaptiveFeedbackMessage } = useAdaptiveDifficulty()
  const { boostMomentum } = useSteamJourney()

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
    if (state.correctAnswers >= state.raceGoal && state.isGameActive && state.style === 'practice') {
      // End the game
      dispatch({ type: 'END_RACE' })
      // Show results after a short delay
      setTimeout(() => {
        dispatch({ type: 'SHOW_RESULTS' })
      }, 1000)
    }
  }, [state.correctAnswers, state.raceGoal, state.isGameActive, state.style, dispatch])

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
          const answer = parseInt(newInput)
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

              // Boost momentum for sprint mode
              if (state.style === 'sprint') {
                boostMomentum()
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
  }, [state.currentInput, state.currentQuestion, state.questionStartTime, state.style, dispatch, trackPerformance, getAdaptiveFeedbackMessage, boostMomentum])

  // Handle route celebration continue
  const handleContinueToNextRoute = () => {
    const nextRoute = state.currentRoute + 1

    // Hide celebration
    dispatch({ type: 'HIDE_ROUTE_CELEBRATION' })

    // Generate new track and passengers for next route
    setTimeout(() => {
      dispatch({
        type: 'START_NEW_ROUTE',
        routeNumber: nextRoute,
        stations: state.stations // Keep same stations for now
      })

      // Generate new passengers
      const newPassengers = generatePassengers(state.stations)
      dispatch({ type: 'GENERATE_PASSENGERS', passengers: newPassengers })
    }, 100)
  }

  if (!state.currentQuestion) return null

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      width: '100%'
    }}>
      {/* Adaptive Feedback */}
      {state.adaptiveFeedback && (
        <div style={{
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
          textAlign: 'center'
        }}>
          {state.adaptiveFeedback.message}
        </div>
      )}

      {/* Stats Header - constrained width */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        padding: '0 20px',
        marginTop: '10px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          marginBottom: '10px',
          background: 'white',
          borderRadius: '12px',
          padding: '10px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>Score</div>
            <div style={{ fontWeight: 'bold', fontSize: '24px', color: '#3b82f6' }}>
              {state.score}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>Streak</div>
            <div style={{ fontWeight: 'bold', fontSize: '24px', color: '#10b981' }}>
              {state.streak} 🔥
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>Progress</div>
            <div style={{ fontWeight: 'bold', fontSize: '24px', color: '#f59e0b' }}>
              {state.correctAnswers}/{state.raceGoal}
            </div>
          </div>
        </div>
      </div>

      {/* Race Track - full width, break out of padding */}
      <div style={{
        width: '100vw',
        position: 'relative',
        left: '50%',
        right: '50%',
        marginLeft: '-50vw',
        marginRight: '-50vw',
        padding: '0 20px',
        display: 'flex',
        justifyContent: 'center'
      }}>
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
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          padding: '0 20px'
        }}>
          <div style={{
            display: 'flex',
            gap: '20px',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '5px'
          }}>
            {/* Question */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px 24px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                ? + {state.currentQuestion.number} = {state.currentQuestion.targetSum}
              </div>
              <div style={{
                fontSize: '60px',
                fontWeight: 'bold',
                color: '#1f2937'
              }}>
                {state.currentQuestion.number}
              </div>
            </div>

            {/* Input */}
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              borderRadius: '12px',
              padding: '16px 36px',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
              textAlign: 'center',
              minWidth: '160px'
            }}>
              <div style={{
                fontSize: '60px',
                fontWeight: 'bold',
                color: 'white',
                minHeight: '70px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
              }}>
                {state.currentInput || '_'}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.9)',
                marginTop: '4px'
              }}>
                Type your answer
              </div>
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