import type { Meta, StoryObj } from '@storybook/react'
import { useState, useCallback, useEffect } from 'react'
import { css } from '../../../styled-system/css'
import { ObserverVisionFeed } from './ObserverVisionFeed'
import type { ObservedVisionFrame, DvrBufferInfo } from '@/hooks/useSessionObserver'

// =============================================================================
// Mock Data
// =============================================================================

/**
 * A simple 100x75 gray placeholder image encoded as base64 JPEG
 * This simulates what a real vision frame would look like
 */
const PLACEHOLDER_IMAGE = `/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCABLAGQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP//Z`

/**
 * Create a mock ObservedVisionFrame
 */
function createMockFrame(overrides: Partial<ObservedVisionFrame> = {}): ObservedVisionFrame {
  return {
    imageData: PLACEHOLDER_IMAGE,
    detectedValue: 42,
    confidence: 0.95,
    receivedAt: Date.now(),
    ...overrides,
  }
}

/**
 * Create a mock DvrBufferInfo
 */
function createMockDvrInfo(overrides: Partial<DvrBufferInfo> = {}): DvrBufferInfo {
  return {
    availableFromMs: 0,
    availableToMs: 60000, // 60 seconds of buffer
    currentProblemStartMs: 0, // Problem started at beginning
    currentProblemNumber: 1, // First problem
    ...overrides,
  }
}

// =============================================================================
// Storybook Meta
// =============================================================================

const meta: Meta<typeof ObserverVisionFeed> = {
  title: 'Vision/ObserverVisionFeed',
  component: ObserverVisionFeed,
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          bg: 'gray.900',
        })}
      >
        <div className={css({ maxWidth: '400px', width: '100%' })}>
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof ObserverVisionFeed>

// =============================================================================
// Stories: Basic States
// =============================================================================

export const LiveFeedWithDetection: Story = {
  name: 'Live Feed - Detection Active',
  args: {
    frame: createMockFrame({ detectedValue: 123, confidence: 0.98 }),
    sessionId: 'test-session-1',
    dvrBufferInfo: createMockDvrInfo(),
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

export const LiveFeedNoDetection: Story = {
  name: 'Live Feed - No Detection',
  args: {
    frame: createMockFrame({ detectedValue: null, confidence: 0 }),
    sessionId: 'test-session-1',
    dvrBufferInfo: createMockDvrInfo(),
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

export const LiveFeedLowConfidence: Story = {
  name: 'Live Feed - Low Confidence',
  args: {
    frame: createMockFrame({ detectedValue: 45, confidence: 0.52 }),
    sessionId: 'test-session-1',
    dvrBufferInfo: createMockDvrInfo(),
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

export const StaleFeed: Story = {
  name: 'Stale Feed - Frame Outdated',
  args: {
    frame: createMockFrame({
      detectedValue: 77,
      confidence: 0.9,
      // Frame received 2 seconds ago, making it stale
      receivedAt: Date.now() - 2000,
    }),
    sessionId: 'test-session-1',
    dvrBufferInfo: createMockDvrInfo(),
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

// =============================================================================
// Stories: DVR States
// =============================================================================

export const DvrAvailable: Story = {
  name: 'DVR Available - Live',
  args: {
    frame: createMockFrame({ detectedValue: 88, confidence: 0.94 }),
    sessionId: 'test-session-1',
    dvrBufferInfo: createMockDvrInfo({
      availableFromMs: 0,
      availableToMs: 45000,
    }), // 45s buffer
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

export const DvrScrubbing: Story = {
  name: 'DVR Scrubbing - Past Frame',
  args: {
    frame: createMockFrame({ detectedValue: 55, confidence: 0.88 }),
    sessionId: 'test-session-1',
    dvrBufferInfo: createMockDvrInfo({
      availableFromMs: 0,
      availableToMs: 60000,
    }),
    isLive: false, // Not live - scrubbing
    onScrub: () => {},
    onGoLive: () => {},
  },
}

export const DvrNotAvailable: Story = {
  name: 'DVR Not Available',
  args: {
    frame: createMockFrame({ detectedValue: 33, confidence: 0.85 }),
    sessionId: 'test-session-1',
    dvrBufferInfo: null, // No buffer info
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

export const DvrEmptyBuffer: Story = {
  name: 'DVR Empty Buffer',
  args: {
    frame: createMockFrame({ detectedValue: 99, confidence: 0.92 }),
    sessionId: 'test-session-1',
    dvrBufferInfo: createMockDvrInfo({ availableFromMs: 0, availableToMs: 0 }), // Empty buffer
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

// =============================================================================
// Stories: Without DVR Controls
// =============================================================================

export const NoDvrControls: Story = {
  name: 'Without DVR Controls',
  args: {
    frame: createMockFrame({ detectedValue: 42, confidence: 0.96 }),
    sessionId: 'test-session-1',
    // No onScrub or onGoLive callbacks - DVR controls won't render
  },
}

// =============================================================================
// Stories: Confidence Levels
// =============================================================================

export const ConfidenceHigh: Story = {
  name: 'Confidence - High (98%)',
  args: {
    frame: createMockFrame({ detectedValue: 100, confidence: 0.98 }),
    sessionId: 'test-session-1',
    dvrBufferInfo: createMockDvrInfo(),
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

export const ConfidenceMedium: Story = {
  name: 'Confidence - Medium (75%)',
  args: {
    frame: createMockFrame({ detectedValue: 75, confidence: 0.75 }),
    sessionId: 'test-session-1',
    dvrBufferInfo: createMockDvrInfo(),
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

export const ConfidenceLow: Story = {
  name: 'Confidence - Low (40%)',
  args: {
    frame: createMockFrame({ detectedValue: 22, confidence: 0.4 }),
    sessionId: 'test-session-1',
    dvrBufferInfo: createMockDvrInfo(),
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

// =============================================================================
// Stories: Interactive
// =============================================================================

function InteractiveObserverFeed() {
  const [isLive, setIsLive] = useState(true)
  const [scrubPosition, setScrubPosition] = useState(100)
  const [frame, setFrame] = useState<ObservedVisionFrame>(
    createMockFrame({ detectedValue: 42, confidence: 0.95 })
  )

  // Simulate live frame updates
  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      setFrame(
        createMockFrame({
          detectedValue: Math.floor(Math.random() * 150),
          confidence: 0.85 + Math.random() * 0.14,
          receivedAt: Date.now(),
        })
      )
    }, 500)

    return () => clearInterval(interval)
  }, [isLive])

  const handleScrub = useCallback((offsetMs: number) => {
    setIsLive(false)
    // In real implementation, this would request frame from server
    // For demo, just show a "past" frame
    setFrame(
      createMockFrame({
        detectedValue: Math.floor(offsetMs / 1000), // Show offset as detected value for demo
        confidence: 0.88,
        receivedAt: Date.now(), // Still fresh, just scrubbed
      })
    )
  }, [])

  const handleGoLive = useCallback(() => {
    setIsLive(true)
  }, [])

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: 4 })}>
      <div
        className={css({
          textAlign: 'center',
          color: 'white',
          fontSize: 'sm',
        })}
      >
        <h3 className={css({ fontWeight: 'bold', mb: 2 })}>Interactive Demo</h3>
        <p className={css({ color: 'gray.400' })}>
          {isLive ? 'Watching live - drag the slider to scrub back' : 'Scrubbing - click Go Live'}
        </p>
      </div>

      <ObserverVisionFeed
        frame={frame}
        sessionId="demo-session"
        dvrBufferInfo={createMockDvrInfo({
          availableFromMs: 0,
          availableToMs: 60000,
        })}
        isLive={isLive}
        onScrub={handleScrub}
        onGoLive={handleGoLive}
      />

      <div
        className={css({
          p: 3,
          bg: 'gray.800',
          borderRadius: 'md',
          fontSize: 'xs',
          color: 'gray.400',
        })}
      >
        <div>Status: {isLive ? 'LIVE' : 'SCRUBBING'}</div>
        <div>Detected Value: {frame.detectedValue ?? 'null'}</div>
        <div>Confidence: {Math.round(frame.confidence * 100)}%</div>
      </div>
    </div>
  )
}

export const Interactive: Story = {
  name: 'Interactive Demo',
  render: () => <InteractiveObserverFeed />,
}

// =============================================================================
// Stories: All States Gallery
// =============================================================================

function AllStatesGallery() {
  const states = [
    {
      label: 'Live - Detection',
      frame: createMockFrame({ detectedValue: 123, confidence: 0.98 }),
      dvr: createMockDvrInfo(),
      isLive: true,
    },
    {
      label: 'Live - No Detection',
      frame: createMockFrame({ detectedValue: null, confidence: 0 }),
      dvr: createMockDvrInfo(),
      isLive: true,
    },
    {
      label: 'Stale Frame',
      frame: createMockFrame({
        detectedValue: 77,
        receivedAt: Date.now() - 3000,
      }),
      dvr: createMockDvrInfo(),
      isLive: true,
    },
    {
      label: 'DVR Not Available',
      frame: createMockFrame({ detectedValue: 42 }),
      dvr: null,
      isLive: true,
    },
    {
      label: 'Scrubbing Past',
      frame: createMockFrame({ detectedValue: 55 }),
      dvr: createMockDvrInfo(),
      isLive: false,
    },
    {
      label: 'Low Confidence',
      frame: createMockFrame({ detectedValue: 22, confidence: 0.35 }),
      dvr: createMockDvrInfo(),
      isLive: true,
    },
  ]

  return (
    <div
      className={css({
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 4,
        maxWidth: '800px',
      })}
    >
      {states.map((state, i) => (
        <div key={i} className={css({ display: 'flex', flexDirection: 'column', gap: 2 })}>
          <span
            className={css({
              fontSize: 'xs',
              fontWeight: 'bold',
              color: 'white',
              textAlign: 'center',
            })}
          >
            {state.label}
          </span>
          <ObserverVisionFeed
            frame={state.frame}
            sessionId={`gallery-${i}`}
            dvrBufferInfo={state.dvr}
            isLive={state.isLive}
            onScrub={() => {}}
            onGoLive={() => {}}
          />
        </div>
      ))}
    </div>
  )
}

export const AllStates: Story = {
  name: 'All States Gallery',
  render: () => <AllStatesGallery />,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          minHeight: '100vh',
          bg: 'gray.900',
        })}
      >
        <Story />
      </div>
    ),
  ],
}

// =============================================================================
// Stories: Per-Problem DVR Scrubbing
// =============================================================================

export const PerProblemScrubbing: Story = {
  name: 'DVR Per-Problem Scrubbing',
  args: {
    frame: createMockFrame({ detectedValue: 88, confidence: 0.94 }),
    sessionId: 'test-session-1',
    // Buffer has 60 seconds total, but current problem started 15 seconds ago
    // So scrubber should only allow scrubbing within the last 15 seconds
    dvrBufferInfo: createMockDvrInfo({
      availableFromMs: 0,
      availableToMs: 60000,
      currentProblemStartMs: 45000, // Problem started 15 seconds ago (60000 - 45000 = 15s)
      currentProblemNumber: 5,
    }),
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

export const PerProblemScrubbingLongProblem: Story = {
  name: 'DVR Per-Problem - Long Problem (45s)',
  args: {
    frame: createMockFrame({ detectedValue: 123, confidence: 0.91 }),
    sessionId: 'test-session-1',
    // Current problem started 45 seconds ago
    dvrBufferInfo: createMockDvrInfo({
      availableFromMs: 0,
      availableToMs: 60000,
      currentProblemStartMs: 15000, // Problem started 45 seconds ago
      currentProblemNumber: 3,
    }),
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

export const PerProblemScrubbingNoProblemInfo: Story = {
  name: 'DVR Per-Problem - No Problem Info',
  args: {
    frame: createMockFrame({ detectedValue: 42, confidence: 0.88 }),
    sessionId: 'test-session-1',
    // No problem info available - falls back to full buffer range
    dvrBufferInfo: createMockDvrInfo({
      availableFromMs: 0,
      availableToMs: 60000,
      currentProblemStartMs: null,
      currentProblemNumber: null,
    }),
    isLive: true,
    onScrub: () => {},
    onGoLive: () => {},
  },
}

// =============================================================================
// Stories: DVR Buffer Sizes
// =============================================================================

function DvrBufferComparison() {
  const bufferSizes = [
    { label: '10 seconds', ms: 10000 },
    { label: '30 seconds', ms: 30000 },
    { label: '60 seconds', ms: 60000 },
  ]

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: 4 })}>
      <h3
        className={css({
          color: 'white',
          fontWeight: 'bold',
          textAlign: 'center',
        })}
      >
        DVR Buffer Size Comparison
      </h3>
      <div
        className={css({
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          justifyContent: 'center',
        })}
      >
        {bufferSizes.map(({ label, ms }) => (
          <div
            key={ms}
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              width: '300px',
            })}
          >
            <span
              className={css({
                fontSize: 'xs',
                color: 'gray.400',
                textAlign: 'center',
              })}
            >
              {label}
            </span>
            <ObserverVisionFeed
              frame={createMockFrame({ detectedValue: Math.floor(ms / 1000) })}
              sessionId={`buffer-${ms}`}
              dvrBufferInfo={createMockDvrInfo({
                availableFromMs: 0,
                availableToMs: ms,
              })}
              isLive={true}
              onScrub={() => {}}
              onGoLive={() => {}}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export const BufferSizeComparison: Story = {
  name: 'DVR Buffer Size Comparison',
  render: () => <DvrBufferComparison />,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          bg: 'gray.900',
          minHeight: '100vh',
        })}
      >
        <Story />
      </div>
    ),
  ],
}
