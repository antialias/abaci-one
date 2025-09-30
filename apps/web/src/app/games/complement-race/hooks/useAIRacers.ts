import { useEffect } from 'react'
import { useComplementRace } from '../context/ComplementRaceContext'
import { getAICommentary, type CommentaryContext } from '../components/AISystem/aiCommentary'

export function useAIRacers() {
  const { state, dispatch } = useComplementRace()

  useEffect(() => {
    if (!state.isGameActive) return

    // Update AI positions every 200ms (line 11690)
    const aiUpdateInterval = setInterval(() => {
      const newPositions = state.aiRacers.map(racer => {
        // Base speed with random variance (0.6-1.4 range via Math.random() * 0.8 + 0.6)
        const variance = Math.random() * 0.8 + 0.6
        let speed = racer.speed * variance * state.speedMultiplier

        // Rubber-banding: AI speeds up 2x when >10 units behind player (line 11697-11699)
        const distanceBehind = state.correctAnswers - racer.position
        if (distanceBehind > 10) {
          speed *= 2
        }

        // Update position
        const newPosition = racer.position + speed

        return {
          id: racer.id,
          position: newPosition
        }
      })

      dispatch({ type: 'UPDATE_AI_POSITIONS', positions: newPositions })

      // Check for commentary triggers after position updates
      state.aiRacers.forEach(racer => {
        const updatedPosition = newPositions.find(p => p.id === racer.id)?.position || racer.position
        const distanceBehind = state.correctAnswers - updatedPosition
        const distanceAhead = updatedPosition - state.correctAnswers

        // Detect passing events
        const playerJustPassed = racer.previousPosition > state.correctAnswers && updatedPosition < state.correctAnswers
        const aiJustPassed = racer.previousPosition < state.correctAnswers && updatedPosition > state.correctAnswers

        // Determine commentary context
        let context: CommentaryContext | null = null

        if (playerJustPassed) {
          context = 'player_passed'
        } else if (aiJustPassed) {
          context = 'ai_passed'
        } else if (distanceBehind > 20) {
          // Player has lapped the AI (more than 20 units behind)
          context = 'lapped'
        } else if (distanceBehind > 10) {
          // AI is desperate to catch up (rubber-banding active)
          context = 'desperate_catchup'
        } else if (distanceAhead > 5) {
          // AI is significantly ahead
          context = 'ahead'
        } else if (distanceBehind > 3) {
          // AI is behind
          context = 'behind'
        }

        // Trigger commentary if context is valid
        if (context) {
          const message = getAICommentary(racer, context, state.correctAnswers, updatedPosition)
          if (message) {
            dispatch({
              type: 'TRIGGER_AI_COMMENTARY',
              racerId: racer.id,
              message,
              context
            })
          }
        }
      })
    }, 200)

    return () => clearInterval(aiUpdateInterval)
  }, [state.isGameActive, state.aiRacers, state.correctAnswers, state.speedMultiplier, dispatch])

  return {
    aiRacers: state.aiRacers
  }
}