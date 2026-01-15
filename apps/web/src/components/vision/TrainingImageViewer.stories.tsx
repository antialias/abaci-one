import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
// @ts-expect-error - AbacusStatic exists but TypeScript module resolution issue (documented in CLAUDE.md)
import { AbacusStatic } from '@soroban/abacus-react'
import { css } from '../../../styled-system/css'
import { TrainingImageViewer, type TrainingImageMeta, type GroupBy } from './TrainingImageViewer'

/**
 * TrainingImageViewer - Displays collected abacus column training images
 *
 * This component shows training data collected from students using vision mode.
 * Images are 64×128 grayscale column extracts, labeled with the digit they represent.
 *
 * In these stories, we use `AbacusStatic` to generate representative abacus
 * column images instead of actual collected photos.
 */
const meta: Meta<typeof TrainingImageViewer> = {
  title: 'Vision/TrainingImageViewer',
  component: TrainingImageViewer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

// Helper to generate a random ID
function randomId(length = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
}

// Generate mock training image metadata
function generateMockImages(count: number): TrainingImageMeta[] {
  const players = ['alice123', 'bob45678', 'charlie9', 'diana012']
  const sessions = ['sess_abc', 'sess_def', 'sess_ghi', 'sess_jkl', 'sess_mno']

  const images: TrainingImageMeta[] = []
  const now = Date.now()

  for (let i = 0; i < count; i++) {
    const digit = Math.floor(Math.random() * 10)
    const playerId = players[Math.floor(Math.random() * players.length)]
    const sessionId = sessions[Math.floor(Math.random() * sessions.length)]
    const timestamp = now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000) // Last 7 days
    const columnIndex = Math.floor(Math.random() * 5)
    const uuid = randomId()

    images.push({
      filename: `${timestamp}_${playerId}_${sessionId}_col${columnIndex}_${uuid}.png`,
      digit,
      timestamp,
      playerId,
      sessionId,
      columnIndex,
      imageUrl: `/api/vision-training/images/${digit}/${timestamp}_${playerId}_${sessionId}_col${columnIndex}_${uuid}.png`,
    })
  }

  // Sort by timestamp descending (newest first)
  images.sort((a, b) => b.timestamp - a.timestamp)

  return images
}

// Component to render a single abacus column as a training image preview
function AbacusColumnPreview({ digit }: { digit: number }) {
  return (
    <div
      className={css({
        width: '64px',
        height: '128px',
        bg: 'gray.950',
        borderRadius: 'md',
        mb: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      })}
    >
      <AbacusStatic
        value={digit}
        columns={1}
        scaleFactor={0.45}
        colorScheme="monochrome"
        hideInactiveBeads={false}
        frameVisible={false}
        showNumbers={false}
        customStyles={{
          beads: {
            fill: '#9ca3af',
            stroke: '#6b7280',
            strokeWidth: 1,
          },
          frame: {
            fill: 'transparent',
            stroke: 'transparent',
          },
          reckoningBar: {
            fill: '#374151',
            stroke: '#4b5563',
            strokeWidth: 1,
          },
          columnPosts: {
            fill: '#1f2937',
            stroke: '#374151',
            strokeWidth: 1,
          },
        }}
      />
    </div>
  )
}

// Interactive wrapper for stories
function InteractiveViewer({ images }: { images: TrainingImageMeta[] }) {
  const [filterDigit, setFilterDigit] = useState('')
  const [filterPlayer, setFilterPlayer] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('digit')

  // Apply filters
  const filteredImages = images.filter((img) => {
    if (filterDigit && img.digit !== parseInt(filterDigit, 10)) return false
    if (filterPlayer && img.playerId !== filterPlayer) return false
    if (filterSession && img.sessionId !== filterSession) return false
    return true
  })

  return (
    <TrainingImageViewer
      images={filteredImages}
      filterDigit={filterDigit}
      filterPlayer={filterPlayer}
      filterSession={filterSession}
      groupBy={groupBy}
      onFilterDigitChange={setFilterDigit}
      onFilterPlayerChange={setFilterPlayer}
      onFilterSessionChange={setFilterSession}
      onGroupByChange={setGroupBy}
      onRefresh={() => {
        // In real app, this would refetch
        console.log('Refresh clicked')
      }}
      renderImage={(img) => <AbacusColumnPreview digit={img.digit} />}
    />
  )
}

// Generate datasets
const smallDataset = generateMockImages(30)
const mediumDataset = generateMockImages(100)
const largeDataset = generateMockImages(500)

// Ensure balanced distribution for demo
const balancedDataset: TrainingImageMeta[] = []
const players = ['student_a', 'student_b', 'student_c']
const sessions = ['morning', 'afternoon', 'evening']
let balancedTimestamp = Date.now()

for (let digit = 0; digit <= 9; digit++) {
  for (let i = 0; i < 5; i++) {
    const playerId = players[i % players.length]
    const sessionId = sessions[Math.floor(i / 2) % sessions.length]
    balancedTimestamp -= 60000 // 1 minute apart
    const columnIndex = i

    balancedDataset.push({
      filename: `${balancedTimestamp}_${playerId}_${sessionId}_col${columnIndex}_${randomId()}.png`,
      digit,
      timestamp: balancedTimestamp,
      playerId,
      sessionId,
      columnIndex,
      imageUrl: `/api/vision-training/images/${digit}/mock.png`,
    })
  }
}

/**
 * Default view with a balanced dataset of 50 images (5 per digit)
 */
export const Default: Story = {
  render: () => <InteractiveViewer images={balancedDataset} />,
}

/**
 * Empty state when no images have been collected yet
 */
export const Empty: Story = {
  args: {
    images: [],
    loading: false,
    error: null,
    groupBy: 'digit',
  },
}

/**
 * Loading state while fetching images
 */
export const Loading: Story = {
  args: {
    images: [],
    loading: true,
    error: null,
    groupBy: 'digit',
  },
}

/**
 * Error state when API fails
 */
export const ErrorState: Story = {
  args: {
    images: [],
    loading: false,
    error: 'Failed to load training images. Check that the API is running.',
    groupBy: 'digit',
  },
}

/**
 * Small dataset with ~30 images
 */
export const SmallDataset: Story = {
  render: () => <InteractiveViewer images={smallDataset} />,
}

/**
 * Medium dataset with ~100 images
 */
export const MediumDataset: Story = {
  render: () => <InteractiveViewer images={mediumDataset} />,
}

/**
 * Large dataset with ~500 images to test performance
 */
export const LargeDataset: Story = {
  render: () => <InteractiveViewer images={largeDataset} />,
}

/**
 * Grouped by player to see contributions per student
 */
export const GroupedByPlayer: Story = {
  render: () => {
    const [filterDigit, setFilterDigit] = useState('')
    const [filterPlayer, setFilterPlayer] = useState('')
    const [filterSession, setFilterSession] = useState('')
    const [groupBy, setGroupBy] = useState<GroupBy>('player')

    const filteredImages = balancedDataset.filter((img) => {
      if (filterDigit && img.digit !== parseInt(filterDigit, 10)) return false
      if (filterPlayer && img.playerId !== filterPlayer) return false
      if (filterSession && img.sessionId !== filterSession) return false
      return true
    })

    return (
      <TrainingImageViewer
        images={filteredImages}
        filterDigit={filterDigit}
        filterPlayer={filterPlayer}
        filterSession={filterSession}
        groupBy={groupBy}
        onFilterDigitChange={setFilterDigit}
        onFilterPlayerChange={setFilterPlayer}
        onFilterSessionChange={setFilterSession}
        onGroupByChange={setGroupBy}
        renderImage={(img) => <AbacusColumnPreview digit={img.digit} />}
      />
    )
  },
}

/**
 * Grouped by session to see data collected per practice session
 */
export const GroupedBySession: Story = {
  render: () => {
    const [filterDigit, setFilterDigit] = useState('')
    const [filterPlayer, setFilterPlayer] = useState('')
    const [filterSession, setFilterSession] = useState('')
    const [groupBy, setGroupBy] = useState<GroupBy>('session')

    const filteredImages = balancedDataset.filter((img) => {
      if (filterDigit && img.digit !== parseInt(filterDigit, 10)) return false
      if (filterPlayer && img.playerId !== filterPlayer) return false
      if (filterSession && img.sessionId !== filterSession) return false
      return true
    })

    return (
      <TrainingImageViewer
        images={filteredImages}
        filterDigit={filterDigit}
        filterPlayer={filterPlayer}
        filterSession={filterSession}
        groupBy={groupBy}
        onFilterDigitChange={setFilterDigit}
        onFilterPlayerChange={setFilterPlayer}
        onFilterSessionChange={setFilterSession}
        onGroupByChange={setGroupBy}
        renderImage={(img) => <AbacusColumnPreview digit={img.digit} />}
      />
    )
  },
}

/**
 * Filtered to show only digit 5 (demonstrates filtering)
 */
export const FilteredByDigit: Story = {
  render: () => {
    const [filterDigit, setFilterDigit] = useState('5')
    const [filterPlayer, setFilterPlayer] = useState('')
    const [filterSession, setFilterSession] = useState('')
    const [groupBy, setGroupBy] = useState<GroupBy>('digit')

    const filteredImages = balancedDataset.filter((img) => {
      if (filterDigit && img.digit !== parseInt(filterDigit, 10)) return false
      if (filterPlayer && img.playerId !== filterPlayer) return false
      if (filterSession && img.sessionId !== filterSession) return false
      return true
    })

    return (
      <TrainingImageViewer
        images={filteredImages}
        filterDigit={filterDigit}
        filterPlayer={filterPlayer}
        filterSession={filterSession}
        groupBy={groupBy}
        onFilterDigitChange={setFilterDigit}
        onFilterPlayerChange={setFilterPlayer}
        onFilterSessionChange={setFilterSession}
        onGroupByChange={setGroupBy}
        renderImage={(img) => <AbacusColumnPreview digit={img.digit} />}
      />
    )
  },
}

/**
 * Shows all digits with their abacus representations side by side
 */
export const AllDigitsShowcase: Story = {
  render: () => (
    <div
      className={css({
        minHeight: '100vh',
        bg: 'gray.900',
        color: 'gray.100',
        p: 6,
      })}
    >
      <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 4 })}>
        Abacus Column Reference (0-9)
      </h1>
      <p className={css({ color: 'gray.400', fontSize: 'sm', mb: 6 })}>
        These are the 10 digit representations used for training the column classifier model.
      </p>
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(10, 1fr)',
          gap: 4,
          maxWidth: '900px',
        })}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <div
            key={digit}
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              p: 3,
              bg: 'gray.800',
              borderRadius: 'lg',
            })}
          >
            <AbacusColumnPreview digit={digit} />
            <div
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                fontFamily: 'mono',
                mt: 2,
              })}
            >
              {digit}
            </div>
          </div>
        ))}
      </div>

      <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', mt: 8, mb: 4 })}>How It Works</h2>
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 4,
          maxWidth: '800px',
        })}
      >
        <div className={css({ bg: 'gray.800', p: 4, borderRadius: 'lg' })}>
          <div
            className={css({
              color: 'blue.400',
              fontWeight: 'semibold',
              mb: 2,
            })}
          >
            Heaven Bead (Top)
          </div>
          <p className={css({ color: 'gray.400', fontSize: 'sm' })}>
            Worth 5 when pushed down to the bar
          </p>
        </div>
        <div className={css({ bg: 'gray.800', p: 4, borderRadius: 'lg' })}>
          <div
            className={css({
              color: 'green.400',
              fontWeight: 'semibold',
              mb: 2,
            })}
          >
            Earth Beads (Bottom)
          </div>
          <p className={css({ color: 'gray.400', fontSize: 'sm' })}>
            Worth 1 each when pushed up to the bar (4 beads = 0-4)
          </p>
        </div>
        <div className={css({ bg: 'gray.800', p: 4, borderRadius: 'lg' })}>
          <div
            className={css({
              color: 'amber.400',
              fontWeight: 'semibold',
              mb: 2,
            })}
          >
            Reckoning Bar
          </div>
          <p className={css({ color: 'gray.400', fontSize: 'sm' })}>
            The horizontal bar separating heaven and earth beads
          </p>
        </div>
      </div>
    </div>
  ),
}
