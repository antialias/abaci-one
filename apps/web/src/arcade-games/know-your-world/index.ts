import { defineGame } from '@/lib/arcade/game-sdk'
import type { GameManifest } from '@/lib/arcade/game-sdk'
import { GameComponent } from './components/GameComponent'
import { KnowYourWorldProvider } from './Provider'
import type { KnowYourWorldConfig, KnowYourWorldMove, KnowYourWorldState } from './types'
import { knowYourWorldValidator } from './Validator'

const manifest: GameManifest = {
  name: 'know-your-world',
  displayName: 'Know Your World',
  icon: '🌍',
  description: 'Test your geography knowledge by finding countries and states on the map!',
  longDescription: `A geography quiz game where you identify countries and states on unlabeled maps.

Features three exciting game modes:
• Cooperative - Work together as a team
• Race - Compete to click first
• Turn-Based - Take turns finding locations

Choose from multiple maps (World, USA States) and difficulty levels!`,
  maxPlayers: 8,
  difficulty: 'Beginner',
  chips: ['👥 Multiplayer', '🎓 Educational', '🗺️ Geography'],
  color: 'blue',
  gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
  borderColor: 'blue.200',
  available: true,
}

const defaultConfig: KnowYourWorldConfig = {
  selectedMap: 'world',
  gameMode: 'cooperative',
  difficulty: 'easy',
  studyDuration: 0,
  selectedContinent: 'all',
}

function validateKnowYourWorldConfig(config: unknown): config is KnowYourWorldConfig {
  const validContinents = [
    'all',
    'africa',
    'asia',
    'europe',
    'north-america',
    'south-america',
    'oceania',
    'antarctica',
  ]

  return (
    typeof config === 'object' &&
    config !== null &&
    'selectedMap' in config &&
    'gameMode' in config &&
    'difficulty' in config &&
    'studyDuration' in config &&
    'selectedContinent' in config &&
    (config.selectedMap === 'world' || config.selectedMap === 'usa') &&
    (config.gameMode === 'cooperative' ||
      config.gameMode === 'race' ||
      config.gameMode === 'turn-based') &&
    (config.difficulty === 'easy' || config.difficulty === 'hard') &&
    (config.studyDuration === 0 ||
      config.studyDuration === 30 ||
      config.studyDuration === 60 ||
      config.studyDuration === 120) &&
    typeof config.selectedContinent === 'string' &&
    validContinents.includes(config.selectedContinent)
  )
}

export const knowYourWorldGame = defineGame<
  KnowYourWorldConfig,
  KnowYourWorldState,
  KnowYourWorldMove
>({
  manifest,
  Provider: KnowYourWorldProvider,
  GameComponent,
  validator: knowYourWorldValidator,
  defaultConfig,
  validateConfig: validateKnowYourWorldConfig,
})
