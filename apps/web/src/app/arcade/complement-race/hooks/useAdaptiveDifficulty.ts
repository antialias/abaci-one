import { useComplementRace } from '../context/ComplementRaceContext'
import type { PairPerformance } from '../lib/gameTypes'

export function useAdaptiveDifficulty() {
  const { state, dispatch } = useComplementRace()

  // Track performance after each answer (lines 14495-14553)
  const trackPerformance = (isCorrect: boolean, responseTime: number) => {
    if (!state.currentQuestion) return

    const pairKey = `${state.currentQuestion.number}_${state.currentQuestion.correctAnswer}_${state.currentQuestion.targetSum}`

    // Get or create performance data for this pair
    const pairData: PairPerformance = state.difficultyTracker.pairPerformance.get(pairKey) || {
      attempts: 0,
      correct: 0,
      avgTime: 0,
      difficulty: 1,
    }

    // Update performance data
    pairData.attempts++
    if (isCorrect) {
      pairData.correct++
    }

    // Update average time (rolling average)
    const totalTime = pairData.avgTime * (pairData.attempts - 1) + responseTime
    pairData.avgTime = totalTime / pairData.attempts

    // Calculate pair-specific difficulty (lines 14555-14576)
    if (pairData.attempts >= 2) {
      const accuracyRate = pairData.correct / pairData.attempts
      const avgTime = pairData.avgTime

      let difficulty = 1
      if (accuracyRate >= 0.9 && avgTime < 1500) {
        difficulty = 1 // Very easy
      } else if (accuracyRate >= 0.8 && avgTime < 2000) {
        difficulty = 2 // Easy
      } else if (accuracyRate >= 0.7 || avgTime < 2500) {
        difficulty = 3 // Medium
      } else if (accuracyRate >= 0.5 || avgTime < 3500) {
        difficulty = 4 // Hard
      } else {
        difficulty = 5 // Very hard
      }

      pairData.difficulty = difficulty
    }

    // Update difficulty tracker in state
    const newPairPerformance = new Map(state.difficultyTracker.pairPerformance)
    newPairPerformance.set(pairKey, pairData)

    // Update consecutive counters
    const newTracker = {
      ...state.difficultyTracker,
      pairPerformance: newPairPerformance,
      consecutiveCorrect: isCorrect ? state.difficultyTracker.consecutiveCorrect + 1 : 0,
      consecutiveIncorrect: !isCorrect ? state.difficultyTracker.consecutiveIncorrect + 1 : 0,
    }

    // Adapt global difficulty (lines 14578-14605)
    if (newTracker.consecutiveCorrect >= 3) {
      // Reduce time limit (increase difficulty)
      newTracker.currentTimeLimit = Math.max(
        1000,
        newTracker.currentTimeLimit - newTracker.currentTimeLimit * newTracker.adaptationRate
      )
    } else if (newTracker.consecutiveIncorrect >= 2) {
      // Increase time limit (decrease difficulty)
      newTracker.currentTimeLimit = Math.min(
        5000,
        newTracker.currentTimeLimit + newTracker.baseTimeLimit * newTracker.adaptationRate
      )
    }

    // Update overall difficulty level
    const avgDifficulty =
      Array.from(newTracker.pairPerformance.values()).reduce(
        (sum, data) => sum + data.difficulty,
        0
      ) / Math.max(1, newTracker.pairPerformance.size)

    newTracker.difficultyLevel = Math.round(avgDifficulty)

    // Exit learning mode after sufficient data (lines 14548-14552)
    if (
      newTracker.pairPerformance.size >= 5 &&
      Array.from(newTracker.pairPerformance.values()).some((data) => data.attempts >= 3)
    ) {
      newTracker.learningMode = false
    }

    // Dispatch update
    dispatch({ type: 'UPDATE_DIFFICULTY_TRACKER', tracker: newTracker })

    // Adapt AI speeds based on player performance
    adaptAISpeeds(newTracker)
  }

  // Calculate recent success rate (lines 14685-14693)
  const calculateRecentSuccessRate = (): number => {
    const recentQuestions = Math.min(10, state.totalQuestions)
    if (recentQuestions === 0) return 0.5 // Default for first question

    // Use global tracking for recent performance
    const recentCorrect = Math.max(
      0,
      state.correctAnswers - Math.max(0, state.totalQuestions - recentQuestions)
    )
    return recentCorrect / recentQuestions
  }

  // Calculate average response time (lines 14695-14705)
  const calculateAverageResponseTime = (): number => {
    const recentPairs = Array.from(state.difficultyTracker.pairPerformance.values())
      .filter((data) => data.attempts >= 1)
      .slice(-5) // Last 5 different pairs encountered

    if (recentPairs.length === 0) return 3000 // Default for learning mode

    const totalTime = recentPairs.reduce((sum, data) => sum + data.avgTime, 0)
    return totalTime / recentPairs.length
  }

  // Adapt AI speeds based on performance (lines 14607-14683)
  const adaptAISpeeds = (tracker: typeof state.difficultyTracker) => {
    // Don't adapt during learning mode
    if (tracker.learningMode) return

    const playerSuccessRate = calculateRecentSuccessRate()
    const avgResponseTime = calculateAverageResponseTime()

    // Base speed multipliers for each race mode
    let baseSpeedMultiplier: number
    switch (state.style) {
      case 'practice':
        baseSpeedMultiplier = 0.7
        break
      case 'sprint':
        baseSpeedMultiplier = 0.9
        break
      case 'survival':
        baseSpeedMultiplier = state.speedMultiplier * state.survivalMultiplier
        break
      default:
        baseSpeedMultiplier = 0.7
    }

    // Calculate adaptive multiplier based on player performance
    let adaptiveMultiplier = 1.0

    // Success rate factor (0.5x to 1.6x based on success rate)
    if (playerSuccessRate > 0.85) {
      adaptiveMultiplier *= 1.6 // Player doing great - speed up AI significantly
    } else if (playerSuccessRate > 0.75) {
      adaptiveMultiplier *= 1.3 // Player doing well - speed up AI moderately
    } else if (playerSuccessRate > 0.6) {
      adaptiveMultiplier *= 1.0 // Player doing okay - keep AI at base speed
    } else if (playerSuccessRate > 0.45) {
      adaptiveMultiplier *= 0.75 // Player struggling - slow down AI
    } else {
      adaptiveMultiplier *= 0.5 // Player really struggling - significantly slow AI
    }

    // Response time factor - faster players get faster AI
    if (avgResponseTime < 1500) {
      adaptiveMultiplier *= 1.2 // Very fast player
    } else if (avgResponseTime < 2500) {
      adaptiveMultiplier *= 1.1 // Fast player
    } else if (avgResponseTime > 4000) {
      adaptiveMultiplier *= 0.9 // Slow player
    }

    // Streak bonus - players on hot streaks get more challenge
    if (state.streak >= 8) {
      adaptiveMultiplier *= 1.3
    } else if (state.streak >= 5) {
      adaptiveMultiplier *= 1.15
    }

    // Apply bounds to prevent extreme values
    adaptiveMultiplier = Math.max(0.3, Math.min(2.0, adaptiveMultiplier))

    // Update AI speeds with adaptive multiplier
    const finalSpeedMultiplier = baseSpeedMultiplier * adaptiveMultiplier

    // Update AI racer speeds
    const updatedRacers = state.aiRacers.map((racer, index) => {
      if (index === 0) {
        // Swift AI (more aggressive)
        return { ...racer, speed: 0.32 * finalSpeedMultiplier }
      } else {
        // Math Bot (more consistent)
        return { ...racer, speed: 0.2 * finalSpeedMultiplier }
      }
    })

    dispatch({ type: 'UPDATE_AI_SPEEDS', racers: updatedRacers })

    // Debug logging for AI adaptation (every 5 questions)
    if (state.totalQuestions % 5 === 0) {
      console.log('🤖 AI Speed Adaptation:', {
        playerSuccessRate: `${Math.round(playerSuccessRate * 100)}%`,
        avgResponseTime: `${Math.round(avgResponseTime)}ms`,
        streak: state.streak,
        adaptiveMultiplier: Math.round(adaptiveMultiplier * 100) / 100,
        swiftAISpeed: updatedRacers[0] ? Math.round(updatedRacers[0].speed * 1000) / 1000 : 0,
        mathBotSpeed: updatedRacers[1] ? Math.round(updatedRacers[1].speed * 1000) / 1000 : 0,
      })
    }
  }

  // Get adaptive time limit for current question (lines 14740-14763)
  const getAdaptiveTimeLimit = (): number => {
    if (!state.currentQuestion) return 3000

    let adaptiveTime: number

    if (state.difficultyTracker.learningMode) {
      adaptiveTime = Math.max(2000, state.difficultyTracker.currentTimeLimit)
    } else {
      const pairKey = `${state.currentQuestion.number}_${state.currentQuestion.correctAnswer}_${state.currentQuestion.targetSum}`
      const pairData = state.difficultyTracker.pairPerformance.get(pairKey)

      if (pairData && pairData.attempts >= 2) {
        // Use pair-specific difficulty
        const baseTime = state.difficultyTracker.baseTimeLimit
        const difficultyMultiplier = (6 - pairData.difficulty) / 5 // Invert: difficulty 1 = more time
        adaptiveTime = Math.max(1000, baseTime * difficultyMultiplier)
      } else {
        // Default for new pairs
        adaptiveTime = state.difficultyTracker.currentTimeLimit
      }
    }

    // Apply user timeout setting override (lines 14765-14785)
    return applyTimeoutSetting(adaptiveTime)
  }

  // Apply timeout setting multiplier (lines 14765-14785)
  const applyTimeoutSetting = (baseTime: number): number => {
    switch (state.timeoutSetting) {
      case 'preschool':
        return Math.max(baseTime * 4, 20000) // At least 20 seconds
      case 'kindergarten':
        return Math.max(baseTime * 3, 15000) // At least 15 seconds
      case 'relaxed':
        return Math.max(baseTime * 2.4, 12000) // At least 12 seconds
      case 'slow':
        return Math.max(baseTime * 1.6, 8000) // At least 8 seconds
      case 'normal':
        return Math.max(baseTime, 5000) // At least 5 seconds
      case 'fast':
        return Math.max(baseTime * 0.6, 3000) // At least 3 seconds
      case 'expert':
        return Math.max(baseTime * 0.4, 2000) // At least 2 seconds
      default:
        return baseTime
    }
  }

  // Get adaptive feedback message (lines 11655-11721)
  const getAdaptiveFeedbackMessage = (
    pairKey: string,
    _isCorrect: boolean,
    _responseTime: number
  ): {
    message: string
    type: 'learning' | 'struggling' | 'mastered' | 'adapted'
  } | null => {
    const pairData = state.difficultyTracker.pairPerformance.get(pairKey)
    const [num1, num2, _sum] = pairKey.split('_').map(Number)

    // Learning mode messages
    if (state.difficultyTracker.learningMode) {
      const encouragements = [
        "🧠 I'm learning your style! Keep going!",
        '📊 Building your skill profile...',
        '🎯 Every answer helps me understand you better!',
        '🚀 Analyzing your complement superpowers!',
      ]
      return {
        message: encouragements[Math.floor(Math.random() * encouragements.length)],
        type: 'learning',
      }
    }

    // After learning - provide specific feedback
    if (pairData && pairData.attempts >= 3) {
      const accuracy = pairData.correct / pairData.attempts
      const avgTime = pairData.avgTime

      // Struggling pairs (< 60% accuracy)
      if (accuracy < 0.6) {
        const strugglingMessages = [
          `💪 ${num1}+${num2} needs practice - I'm giving you extra time!`,
          `🎯 Working on ${num1}+${num2} - you've got this!`,
          `⏰ Taking it slower with ${num1}+${num2} - no rush!`,
          `🧩 ${num1}+${num2} is getting special attention from me!`,
        ]
        return {
          message: strugglingMessages[Math.floor(Math.random() * strugglingMessages.length)],
          type: 'struggling',
        }
      }

      // Mastered pairs (> 85% accuracy and fast)
      if (accuracy > 0.85 && avgTime < 2000) {
        const masteredMessages = [
          `⚡ ${num1}+${num2} = MASTERED! Lightning mode activated!`,
          `🔥 You've conquered ${num1}+${num2} - speeding it up!`,
          `🏆 ${num1}+${num2} expert detected! Challenge mode ON!`,
          `⭐ ${num1}+${num2} is your superpower! Going faster!`,
        ]
        return {
          message: masteredMessages[Math.floor(Math.random() * masteredMessages.length)],
          type: 'mastered',
        }
      }
    }

    // Show adaptation when difficulty changes
    if (state.difficultyTracker.consecutiveCorrect >= 3) {
      return {
        message: "🚀 You're on fire! Increasing the challenge!",
        type: 'adapted',
      }
    } else if (state.difficultyTracker.consecutiveIncorrect >= 2) {
      return {
        message: "🤗 Let's slow down a bit - I'm here to help!",
        type: 'adapted',
      }
    }

    return null
  }

  return {
    trackPerformance,
    getAdaptiveTimeLimit,
    calculateRecentSuccessRate,
    calculateAverageResponseTime,
    getAdaptiveFeedbackMessage,
  }
}
