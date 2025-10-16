/**
 * Math Sprint Game Definition
 *
 * A free-for-all math game demonstrating the TEAM_MOVE pattern.
 * Players race to solve math problems - first correct answer wins points.
 */

import { defineGame } from '@/lib/arcade/game-sdk'
import type { GameManifest } from '@/lib/arcade/game-sdk'
import { GameComponent } from './components/GameComponent'
import { MathSprintProvider } from './Provider'
import type { MathSprintConfig, MathSprintMove, MathSprintState } from './types'
import { mathSprintValidator } from './Validator'

const manifest: GameManifest = {
  name: 'math-sprint',
  displayName: 'Math Sprint',
  icon: '🧮',
  description: 'Race to solve math problems!',
  longDescription:
    'A fast-paced free-for-all game where players compete to solve math problems. First correct answer earns points. Choose your difficulty and test your mental math skills!',
  maxPlayers: 8,
  difficulty: 'Beginner',
  chips: ['👥 Multiplayer', '⚡ Fast-Paced', '🧠 Mental Math'],
  color: 'purple',
  gradient: 'linear-gradient(135deg, #ddd6fe, #c4b5fd)',
  borderColor: 'purple.200',
  available: true,
}

const defaultConfig: MathSprintConfig = {
  difficulty: 'medium',
  questionsPerRound: 10,
  timePerQuestion: 30,
}

export const mathSprintGame = defineGame<MathSprintConfig, MathSprintState, MathSprintMove>({
  manifest,
  Provider: MathSprintProvider,
  GameComponent,
  validator: mathSprintValidator,
  defaultConfig,
})
