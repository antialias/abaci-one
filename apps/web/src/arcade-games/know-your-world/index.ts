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
  practiceBreakReady: false,
}

const defaultConfig: KnowYourWorldConfig = {
  selectedMap: 'world',
  gameMode: 'cooperative',
  includeSizes: ['huge', 'large', 'medium'],
  assistanceLevel: 'helpful',
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

  const validSizes = ['huge', 'large', 'medium', 'small', 'tiny']
  const validAssistanceLevels = ['learning', 'guided', 'helpful', 'standard', 'none']

  return (
    typeof config === 'object' &&
    config !== null &&
    'selectedMap' in config &&
    'gameMode' in config &&
    'includeSizes' in config &&
    'assistanceLevel' in config &&
    'selectedContinent' in config &&
    (config.selectedMap === 'world' || config.selectedMap === 'usa') &&
    (config.gameMode === 'cooperative' ||
      config.gameMode === 'race' ||
      config.gameMode === 'turn-based') &&
    Array.isArray(config.includeSizes) &&
    config.includeSizes.every((s: unknown) => typeof s === 'string' && validSizes.includes(s)) &&
    typeof config.assistanceLevel === 'string' &&
    validAssistanceLevels.includes(config.assistanceLevel) &&
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
