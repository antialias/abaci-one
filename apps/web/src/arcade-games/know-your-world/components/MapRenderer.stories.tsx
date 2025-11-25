import type { Meta, StoryObj } from '@storybook/react'
import { MapRenderer } from './MapRenderer'
import { getFilteredMapDataSync } from '../maps'
import type { ContinentId } from '../continents'

// Custom args type for stories (not actual component props)
type StoryArgs = {
  continent: ContinentId | 'all'
  difficulty: 'easy' | 'hard'
  showArrows: boolean
  centeringStrength: number
  collisionPadding: number
  simulationIterations: number
  useObstacles: boolean
  obstaclePadding: number
}

const meta: Meta<StoryArgs> = {
  title: 'Arcade/KnowYourWorld/MapRenderer',
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    continent: {
      control: 'select',
      options: [
        'all',
        'africa',
        'asia',
        'europe',
        'north-america',
        'south-america',
        'oceania',
        'antarctica',
      ],
      description: 'Select a continent to filter the map',
    },
    difficulty: {
      control: 'select',
      options: ['easy', 'hard'],
      description: 'Game difficulty',
    },
    showArrows: {
      control: 'boolean',
      description: 'Show arrow labels for small regions (experimental feature)',
    },
    centeringStrength: {
      control: { type: 'range', min: 0.1, max: 10, step: 0.1 },
      description: 'Force pulling labels back to regions (higher = stronger)',
    },
    collisionPadding: {
      control: { type: 'range', min: 0, max: 50, step: 1 },
      description: 'Extra padding around labels for collision detection',
    },
    simulationIterations: {
      control: { type: 'range', min: 0, max: 500, step: 10 },
      description: 'Number of simulation iterations (more = more settled)',
    },
    useObstacles: {
      control: 'boolean',
      description: 'Use region obstacles to push labels away from map',
    },
    obstaclePadding: {
      control: { type: 'range', min: 0, max: 50, step: 1 },
      description: 'Extra padding around region obstacles',
    },
  },
}

export default meta
type Story = StoryObj<StoryArgs>

// Mock data
const mockPlayerMetadata = {
  'player-1': {
    id: 'player-1',
    name: 'Player 1',
    emoji: '😊',
    color: '#3b82f6',
  },
  'player-2': {
    id: 'player-2',
    name: 'Player 2',
    emoji: '🎮',
    color: '#ef4444',
  },
}

// Story template
const Template = (args: StoryArgs) => {
  const mapData = getFilteredMapDataSync('world', args.continent, args.difficulty)

  // Simulate some found regions (first 5 regions)
  const regionsFound = mapData.regions.slice(0, 5).map((r) => r.id)

  // Mock guess history
  const guessHistory = regionsFound.map((regionId, index) => ({
    playerId: index % 2 === 0 ? 'player-1' : 'player-2',
    regionId,
    correct: true,
  }))

  return (
    <div style={{ padding: '20px', minHeight: '100vh', background: '#111827' }}>
      <MapRenderer
        mapData={mapData}
        regionsFound={regionsFound}
        currentPrompt={mapData.regions[5]?.id || null}
        difficulty={args.difficulty}
        selectedMap="world"
        selectedContinent={args.continent}
        onRegionClick={(id, name) => console.log('Clicked:', id, name)}
        guessHistory={guessHistory}
        playerMetadata={mockPlayerMetadata}
        giveUpReveal={null}
        onGiveUp={() => console.log('Give Up clicked')}
        forceTuning={{
          showArrows: args.showArrows,
          centeringStrength: args.centeringStrength,
          collisionPadding: args.collisionPadding,
          simulationIterations: args.simulationIterations,
          useObstacles: args.useObstacles,
          obstaclePadding: args.obstaclePadding,
        }}
      />
    </div>
  )
}

export const Oceania: Story = {
  render: Template,
  args: {
    continent: 'oceania',
    difficulty: 'easy',
    showArrows: false,
    centeringStrength: 2.0,
    collisionPadding: 5,
    simulationIterations: 200,
    useObstacles: true,
    obstaclePadding: 10,
  },
}

export const Europe: Story = {
  render: Template,
  args: {
    continent: 'europe',
    difficulty: 'easy',
    showArrows: false,
    centeringStrength: 2.0,
    collisionPadding: 5,
    simulationIterations: 200,
    useObstacles: true,
    obstaclePadding: 10,
  },
}

export const Africa: Story = {
  render: Template,
  args: {
    continent: 'africa',
    difficulty: 'easy',
    showArrows: false,
    centeringStrength: 2.0,
    collisionPadding: 5,
    simulationIterations: 200,
    useObstacles: true,
    obstaclePadding: 10,
  },
}

export const AllWorld: Story = {
  render: Template,
  args: {
    continent: 'all',
    difficulty: 'easy',
    showArrows: false,
    centeringStrength: 2.0,
    collisionPadding: 5,
    simulationIterations: 200,
    useObstacles: true,
    obstaclePadding: 10,
  },
}
