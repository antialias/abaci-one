/**
 * Storybook stories for Know Your World Music System
 *
 * Demonstrates:
 * - Music control panel
 * - Continental presets
 * - Celebration flourishes (lightning, standard, hard-earned)
 * - Temperature effects (hot/cold feedback)
 * - Hyper-local hints
 */

import type { Meta, StoryObj } from '@storybook/react'
import { useState, useCallback } from 'react'
import { css } from '@styled/css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { MusicProvider, useMusic } from './MusicContext'
import { MusicControlPanel } from './MusicControlPanel'
import type { FeedbackType } from '../utils/hotColdPhrases'
import type { CelebrationType } from '../Provider'

// Story args type
type StoryArgs = {
  mapType: 'world' | 'usa'
  regionId: string
  isGameActive: boolean
}

const meta: Meta<StoryArgs> = {
  title: 'Arcade/KnowYourWorld/Music',
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    mapType: {
      control: 'select',
      options: ['world', 'usa'],
      description: 'Map type affects continental presets',
    },
    regionId: {
      control: 'select',
      options: [
        // World regions
        'FR', // France (Europe)
        'JP', // Japan (Asia)
        'BR', // Brazil (Americas)
        'NG', // Nigeria (Africa)
        'AU', // Australia (Oceania)
        'IN', // India (Asia - has hint)
        'IE', // Ireland (Europe - has hint)
        // USA regions
        'LA', // Louisiana (has hint)
        'TN', // Tennessee (has hint)
        'CA', // California
      ],
      description: 'Current region ID - affects preset and potential hint',
    },
    isGameActive: {
      control: 'boolean',
      description: 'Whether the game is active (affects auto-play)',
    },
  },
}

export default meta
type Story = StoryObj<StoryArgs>

// Interactive controls component
function MusicDemoControls() {
  const music = useMusic()
  const [selectedCelebration, setSelectedCelebration] = useState<CelebrationType>('standard')
  const [selectedTemperature, setSelectedTemperature] = useState<FeedbackType | 'neutral'>(
    'neutral'
  )

  const handleCelebration = useCallback(() => {
    music.playCelebration(selectedCelebration)
  }, [music, selectedCelebration])

  const handleTemperature = useCallback(() => {
    music.setTemperature(selectedTemperature === 'neutral' ? null : selectedTemperature)
  }, [music, selectedTemperature])

  const celebrationTypes: CelebrationType[] = ['lightning', 'standard', 'hard-earned']
  const temperatureTypes: (FeedbackType | 'neutral')[] = [
    'neutral',
    'on_fire',
    'hot',
    'warmer',
    'found_it',
    'colder',
    'cold',
    'freezing',
    'overshot',
    'stuck',
  ]

  return (
    <div
      data-component="music-demo-controls"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        padding: '4',
        bg: 'gray.100',
        borderRadius: 'lg',
        minWidth: '300px',
      })}
    >
      {/* Status */}
      <div data-section="status">
        <h3 className={css({ fontWeight: 'bold', mb: '2' })}>Status</h3>
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2',
            fontSize: 'sm',
          })}
        >
          <span>Initialized:</span>
          <span>{music.isInitialized ? '✅' : '❌'}</span>
          <span>Playing:</span>
          <span>{music.isPlaying ? '✅' : '❌'}</span>
          <span>Muted:</span>
          <span>{music.isMuted ? '✅' : '❌'}</span>
          <span>Volume:</span>
          <span>{Math.round(music.volume * 100)}%</span>
          <span>Preset:</span>
          <span>{music.currentPresetName}</span>
          <span>Hint Active:</span>
          <span>{music.isHintActive ? `✅ (${music.hintRegionId})` : '❌'}</span>
          <span>Temperature:</span>
          <span>{music.currentTemperature || 'neutral'}</span>
        </div>
      </div>

      {/* Celebration Controls */}
      <div data-section="celebrations">
        <h3 className={css({ fontWeight: 'bold', mb: '2' })}>Celebrations</h3>
        <div
          className={css({
            display: 'flex',
            gap: '2',
            flexWrap: 'wrap',
            mb: '2',
          })}
        >
          {celebrationTypes.map((type) => (
            <button
              key={type}
              data-action={`select-celebration-${type}`}
              onClick={() => setSelectedCelebration(type)}
              className={css({
                px: '3',
                py: '1',
                borderRadius: 'md',
                border: '2px solid',
                borderColor: selectedCelebration === type ? 'blue.500' : 'gray.300',
                bg: selectedCelebration === type ? 'blue.100' : 'white',
                cursor: 'pointer',
                fontSize: 'sm',
              })}
            >
              {type}
            </button>
          ))}
        </div>
        <button
          data-action="trigger-celebration"
          onClick={handleCelebration}
          disabled={!music.isPlaying}
          className={css({
            px: '4',
            py: '2',
            bg: music.isPlaying ? 'green.500' : 'gray.300',
            color: 'white',
            borderRadius: 'md',
            cursor: music.isPlaying ? 'pointer' : 'not-allowed',
            fontWeight: 'medium',
            width: '100%',
          })}
        >
          🎉 Play Celebration
        </button>
        <p className={css({ fontSize: 'xs', color: 'gray.500', mt: '1' })}>
          {!music.isPlaying && 'Start music first to hear celebrations'}
        </p>
      </div>

      {/* Temperature Controls */}
      <div data-section="temperature">
        <h3 className={css({ fontWeight: 'bold', mb: '2' })}>Temperature (Hot/Cold Feedback)</h3>
        <select
          data-element="temperature-select"
          value={selectedTemperature}
          onChange={(e) => setSelectedTemperature(e.target.value as FeedbackType | 'neutral')}
          className={css({
            width: '100%',
            padding: '2',
            borderRadius: 'md',
            border: '1px solid',
            borderColor: 'gray.300',
            mb: '2',
          })}
        >
          {temperatureTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <button
          data-action="apply-temperature"
          onClick={handleTemperature}
          disabled={!music.isPlaying}
          className={css({
            px: '4',
            py: '2',
            bg: music.isPlaying ? 'orange.500' : 'gray.300',
            color: 'white',
            borderRadius: 'md',
            cursor: music.isPlaying ? 'pointer' : 'not-allowed',
            fontWeight: 'medium',
            width: '100%',
          })}
        >
          🌡️ Apply Temperature
        </button>
        <p className={css({ fontSize: 'xs', color: 'gray.500', mt: '1' })}>
          Hot = brighter, faster | Cold = darker, slower
        </p>
      </div>

      {/* Current Pattern */}
      <div data-section="pattern">
        <h3 className={css({ fontWeight: 'bold', mb: '2' })}>Current Pattern</h3>
        <pre
          className={css({
            fontSize: '10px',
            bg: 'gray.800',
            color: 'green.300',
            padding: '2',
            borderRadius: 'md',
            overflow: 'auto',
            maxHeight: '100px',
            whiteSpace: 'pre-wrap',
          })}
        >
          {music.currentPattern || '// No pattern loaded'}
        </pre>
      </div>
    </div>
  )
}

// Template that wraps everything with providers
const Template = (args: StoryArgs) => {
  return (
    <ThemeProvider>
      <MusicProvider
        isGameActive={args.isGameActive}
        currentRegionId={args.regionId}
        mapType={args.mapType}
      >
        <div
          data-component="music-demo"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '4',
            padding: '6',
            minHeight: '600px',
            bg: 'gray.900',
          })}
        >
          <h2
            className={css({
              fontSize: 'xl',
              fontWeight: 'bold',
              color: 'white',
            })}
          >
            Music System Demo
          </h2>

          <div className={css({ display: 'flex', gap: '6', flexWrap: 'wrap' })}>
            {/* Music Control Panel (the actual UI component) */}
            <div
              data-section="control-panel"
              className={css({
                position: 'relative',
                minWidth: '250px',
                minHeight: '200px',
              })}
            >
              <MusicControlPanel />
            </div>

            {/* Interactive demo controls */}
            <MusicDemoControls />
          </div>

          <div
            className={css({
              fontSize: 'sm',
              color: 'gray.400',
              maxWidth: '600px',
            })}
          >
            <h3 className={css({ fontWeight: 'bold', mb: '2' })}>Instructions:</h3>
            <ol
              className={css({
                listStyle: 'decimal',
                pl: '4',
                display: 'flex',
                flexDirection: 'column',
                gap: '1',
              })}
            >
              <li>Click &quot;Enable Music&quot; or &quot;Play&quot; to start the music</li>
              <li>
                Change regions in the Storybook controls to hear different continental presets
              </li>
              <li>Use the celebration buttons to trigger sound effects</li>
              <li>Apply temperature effects to hear the music become brighter/darker</li>
              <li>
                Some regions (India, Ireland, Louisiana, Tennessee) have hyper-local hints that fade
                in after a delay
              </li>
            </ol>
          </div>
        </div>
      </MusicProvider>
    </ThemeProvider>
  )
}

// Default story
export const Default: Story = {
  render: Template,
  args: {
    mapType: 'world',
    regionId: 'FR',
    isGameActive: true,
  },
}

// Europe (France)
export const Europe: Story = {
  render: Template,
  args: {
    mapType: 'world',
    regionId: 'FR',
    isGameActive: true,
  },
}

// Asia (Japan)
export const Asia: Story = {
  render: Template,
  args: {
    mapType: 'world',
    regionId: 'JP',
    isGameActive: true,
  },
}

// Africa (Nigeria)
export const Africa: Story = {
  render: Template,
  args: {
    mapType: 'world',
    regionId: 'NG',
    isGameActive: true,
  },
}

// Americas (Brazil)
export const Americas: Story = {
  render: Template,
  args: {
    mapType: 'world',
    regionId: 'BR',
    isGameActive: true,
  },
}

// Oceania (Australia)
export const Oceania: Story = {
  render: Template,
  args: {
    mapType: 'world',
    regionId: 'AU',
    isGameActive: true,
  },
}

// India with Hyper-local Hint
export const IndiaWithHint: Story = {
  render: Template,
  args: {
    mapType: 'world',
    regionId: 'IN',
    isGameActive: true,
  },
}

// USA - Louisiana with Jazz Hint
export const USALouisiana: Story = {
  render: Template,
  args: {
    mapType: 'usa',
    regionId: 'LA',
    isGameActive: true,
  },
}

// USA - Tennessee with Country Hint
export const USATennessee: Story = {
  render: Template,
  args: {
    mapType: 'usa',
    regionId: 'TN',
    isGameActive: true,
  },
}
