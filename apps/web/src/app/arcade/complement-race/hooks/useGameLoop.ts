import { useCallback, useEffect } from 'react'
import { useComplementRace } from '@/arcade-games/complement-race/Provider'

export function useGameLoop() {
  const { state, dispatch } = useComplementRace()

  // Generate first question when game begins
  useEffect(() => {
    if (state.gamePhase === 'playing' && !state.currentQuestion) {
      dispatch({ type: 'NEXT_QUESTION' })
    }
  }, [state.gamePhase, state.currentQuestion, dispatch])

  const nextQuestion = useCallback(() => {
    if (!state.isGameActive) return
    dispatch({ type: 'NEXT_QUESTION' })
  }, [state.isGameActive, dispatch])

  const submitAnswer = useCallback(
    (answer: number) => {
      if (!state.currentQuestion) return

      const isCorrect = answer === state.currentQuestion.correctAnswer

      if (isCorrect) {
        // Update score, streak, progress
        // TODO: Will implement full scoring in next step
        dispatch({ type: 'SUBMIT_ANSWER', answer })

        // Move to next question
        dispatch({ type: 'NEXT_QUESTION' })
      } else {
        // Reset streak
        // TODO: Will implement incorrect answer handling
        dispatch({ type: 'SUBMIT_ANSWER', answer })
      }
    },
    [state.currentQuestion, dispatch]
  )

  const startCountdown = useCallback(() => {
    // Trigger countdown phase
    dispatch({ type: 'START_COUNTDOWN' })

    // Start 3-2-1-GO countdown (lines 11163-11211)
    let count = 3
    const countdownInterval = setInterval(() => {
      if (count > 0) {
        // TODO: Play countdown sound
        count--
      } else {
        // GO!
        // TODO: Play start sound
        clearInterval(countdownInterval)

        // Start the actual game after GO animation (1 second delay)
        setTimeout(() => {
          dispatch({ type: 'BEGIN_GAME' })
        }, 1000)
      }
    }, 1000)
  }, [dispatch])

  return {
    nextQuestion,
    submitAnswer,
    startCountdown,
  }
}
