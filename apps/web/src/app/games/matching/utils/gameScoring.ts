import type { MemoryPairsState, GameStatistics, Player } from '../context/types'

// Calculate final game score based on multiple factors
export function calculateFinalScore(
  matchedPairs: number,
  totalPairs: number,
  moves: number,
  gameTime: number,
  difficulty: number,
  gameMode: 'single' | 'two-player'
): number {
  // Base score for completing pairs
  const baseScore = matchedPairs * 100

  // Efficiency bonus (fewer moves = higher bonus)
  const idealMoves = totalPairs * 2 // Perfect game would be 2 moves per pair
  const efficiency = idealMoves / Math.max(moves, idealMoves)
  const efficiencyBonus = Math.round(baseScore * efficiency * 0.5)

  // Time bonus (faster completion = higher bonus)
  const timeInMinutes = gameTime / (1000 * 60)
  const timeBonus = Math.max(0, Math.round((1000 * difficulty) / timeInMinutes))

  // Difficulty multiplier
  const difficultyMultiplier = 1 + (difficulty - 6) * 0.1

  // Two-player mode bonus
  const modeMultiplier = gameMode === 'two-player' ? 1.2 : 1.0

  const finalScore = Math.round(
    (baseScore + efficiencyBonus + timeBonus) * difficultyMultiplier * modeMultiplier
  )

  return Math.max(0, finalScore)
}

// Calculate star rating (1-5 stars) based on performance
export function calculateStarRating(
  accuracy: number,
  efficiency: number,
  gameTime: number,
  difficulty: number
): number {
  // Normalize time score (assuming reasonable time ranges)
  const expectedTime = difficulty * 30000 // 30 seconds per pair as baseline
  const timeScore = Math.max(0, Math.min(100, (expectedTime / gameTime) * 100))

  // Weighted average of different factors
  const overallScore = (accuracy * 0.4) + (efficiency * 0.4) + (timeScore * 0.2)

  // Convert to stars
  if (overallScore >= 90) return 5
  if (overallScore >= 80) return 4
  if (overallScore >= 70) return 3
  if (overallScore >= 60) return 2
  return 1
}

// Get achievement badges based on performance
export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
}

export function getAchievements(state: MemoryPairsState): Achievement[] {
  const { matchedPairs, totalPairs, moves, scores, gameMode, gameStartTime, gameEndTime } = state
  const accuracy = moves > 0 ? (matchedPairs / moves) * 100 : 0
  const gameTime = gameStartTime && gameEndTime ? gameEndTime - gameStartTime : 0
  const gameTimeInSeconds = gameTime / 1000

  const achievements: Achievement[] = [
    {
      id: 'perfect_game',
      name: 'Perfect Memory',
      description: 'Complete a game with 100% accuracy',
      icon: '🧠',
      earned: matchedPairs === totalPairs && moves === totalPairs * 2
    },
    {
      id: 'speed_demon',
      name: 'Speed Demon',
      description: 'Complete a game in under 2 minutes',
      icon: '⚡',
      earned: gameTimeInSeconds > 0 && gameTimeInSeconds < 120 && matchedPairs === totalPairs
    },
    {
      id: 'accuracy_ace',
      name: 'Accuracy Ace',
      description: 'Achieve 90% accuracy or higher',
      icon: '🎯',
      earned: accuracy >= 90 && matchedPairs === totalPairs
    },
    {
      id: 'marathon_master',
      name: 'Marathon Master',
      description: 'Complete the hardest difficulty (15 pairs)',
      icon: '🏃',
      earned: totalPairs === 15 && matchedPairs === totalPairs
    },
    {
      id: 'complement_champion',
      name: 'Complement Champion',
      description: 'Master complement pairs mode',
      icon: '🤝',
      earned: state.gameType === 'complement-pairs' && matchedPairs === totalPairs && accuracy >= 85
    },
    {
      id: 'two_player_triumph',
      name: 'Two-Player Triumph',
      description: 'Win a two-player game',
      icon: '👥',
      earned: gameMode === 'two-player' && matchedPairs === totalPairs &&
        (scores.player1 > scores.player2 || scores.player2 > scores.player1)
    },
    {
      id: 'shutout_victory',
      name: 'Shutout Victory',
      description: 'Win a two-player game without opponent scoring',
      icon: '🛡️',
      earned: gameMode === 'two-player' && matchedPairs === totalPairs &&
        ((scores.player1 === totalPairs && scores.player2 === 0) ||
         (scores.player2 === totalPairs && scores.player1 === 0))
    },
    {
      id: 'comeback_kid',
      name: 'Comeback Kid',
      description: 'Win after being behind by 3+ points',
      icon: '🔄',
      earned: false // This would need more complex tracking during the game
    },
    {
      id: 'first_timer',
      name: 'First Timer',
      description: 'Complete your first game',
      icon: '🌟',
      earned: matchedPairs === totalPairs
    },
    {
      id: 'consistency_king',
      name: 'Consistency King',
      description: 'Achieve 80%+ accuracy in 5 consecutive games',
      icon: '👑',
      earned: false // This would need persistent game history
    }
  ]

  return achievements
}

// Get performance metrics and analysis
export function getPerformanceAnalysis(state: MemoryPairsState): {
  statistics: GameStatistics
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'
  strengths: string[]
  improvements: string[]
  starRating: number
} {
  const { matchedPairs, totalPairs, moves, difficulty, gameStartTime, gameEndTime } = state
  const gameTime = gameStartTime && gameEndTime ? gameEndTime - gameStartTime : 0

  // Calculate statistics
  const accuracy = moves > 0 ? (matchedPairs / moves) * 100 : 0
  const averageTimePerMove = moves > 0 ? gameTime / moves : 0
  const statistics: GameStatistics = {
    totalMoves: moves,
    matchedPairs,
    totalPairs,
    gameTime,
    accuracy,
    averageTimePerMove
  }

  // Calculate efficiency (ideal vs actual moves)
  const idealMoves = totalPairs * 2
  const efficiency = (idealMoves / Math.max(moves, idealMoves)) * 100

  // Determine grade
  let grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' = 'F'
  if (accuracy >= 95 && efficiency >= 90) grade = 'A+'
  else if (accuracy >= 90 && efficiency >= 85) grade = 'A'
  else if (accuracy >= 85 && efficiency >= 80) grade = 'B+'
  else if (accuracy >= 80 && efficiency >= 75) grade = 'B'
  else if (accuracy >= 75 && efficiency >= 70) grade = 'C+'
  else if (accuracy >= 70 && efficiency >= 65) grade = 'C'
  else if (accuracy >= 60 && efficiency >= 50) grade = 'D'

  // Calculate star rating
  const starRating = calculateStarRating(accuracy, efficiency, gameTime, difficulty)

  // Analyze strengths and areas for improvement
  const strengths: string[] = []
  const improvements: string[] = []

  if (accuracy >= 90) {
    strengths.push('Excellent memory and pattern recognition')
  } else if (accuracy < 70) {
    improvements.push('Focus on remembering card positions more carefully')
  }

  if (efficiency >= 85) {
    strengths.push('Very efficient with minimal unnecessary moves')
  } else if (efficiency < 60) {
    improvements.push('Try to reduce random guessing and use memory strategies')
  }

  const avgTimePerMoveSeconds = averageTimePerMove / 1000
  if (avgTimePerMoveSeconds < 3) {
    strengths.push('Quick decision making')
  } else if (avgTimePerMoveSeconds > 8) {
    improvements.push('Practice to improve decision speed')
  }

  if (difficulty >= 12) {
    strengths.push('Tackled challenging difficulty levels')
  }

  if (state.gameType === 'complement-pairs' && accuracy >= 80) {
    strengths.push('Strong mathematical complement skills')
  }

  // Fallback messages
  if (strengths.length === 0) {
    strengths.push('Keep practicing to improve your skills!')
  }
  if (improvements.length === 0) {
    improvements.push('Great job! Continue challenging yourself with harder difficulties.')
  }

  return {
    statistics,
    grade,
    strengths,
    improvements,
    starRating
  }
}

// Format time duration for display
export function formatGameTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  return `${remainingSeconds}s`
}

// Get two-player game winner
export function getTwoPlayerWinner(state: MemoryPairsState): {
  winner: Player | 'tie'
  winnerScore: number
  loserScore: number
  margin: number
} {
  const { scores } = state

  if (scores.player1 > scores.player2) {
    return {
      winner: 1,
      winnerScore: scores.player1,
      loserScore: scores.player2,
      margin: scores.player1 - scores.player2
    }
  } else if (scores.player2 > scores.player1) {
    return {
      winner: 2,
      winnerScore: scores.player2,
      loserScore: scores.player1,
      margin: scores.player2 - scores.player1
    }
  } else {
    return {
      winner: 'tie',
      winnerScore: scores.player1,
      loserScore: scores.player2,
      margin: 0
    }
  }
}