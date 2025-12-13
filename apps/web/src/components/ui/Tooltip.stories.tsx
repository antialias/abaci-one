import type { Meta, StoryObj } from '@storybook/react'
import { css } from '../../../styled-system/css'
import { Tooltip, TooltipProvider } from './Tooltip'

const meta: Meta<typeof Tooltip> = {
  title: 'UI/Tooltip',
  component: Tooltip,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div
          className={css({
            padding: '4rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px',
          })}
        >
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof Tooltip>

// =============================================================================
// Basic Usage
// =============================================================================

export const Default: Story = {
  render: () => (
    <Tooltip content="This is a simple tooltip">
      <button
        type="button"
        className={css({
          padding: '0.5rem 1rem',
          backgroundColor: 'blue.500',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
        })}
      >
        Hover me
      </button>
    </Tooltip>
  ),
}

export const LongContent: Story = {
  render: () => (
    <Tooltip content="This is a longer tooltip that demonstrates how the tooltip handles multiple lines of text. It will wrap naturally within the max-width constraint.">
      <button
        type="button"
        className={css({
          padding: '0.5rem 1rem',
          backgroundColor: 'blue.500',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
        })}
      >
        Hover for long text
      </button>
    </Tooltip>
  ),
}

// =============================================================================
// Positioning
// =============================================================================

export const PositionTop: Story = {
  render: () => (
    <Tooltip content="Tooltip on top" side="top">
      <button
        type="button"
        className={css({
          padding: '0.5rem 1rem',
          backgroundColor: 'gray.600',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
        })}
      >
        Top (default)
      </button>
    </Tooltip>
  ),
}

export const PositionBottom: Story = {
  render: () => (
    <Tooltip content="Tooltip on bottom" side="bottom">
      <button
        type="button"
        className={css({
          padding: '0.5rem 1rem',
          backgroundColor: 'gray.600',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
        })}
      >
        Bottom
      </button>
    </Tooltip>
  ),
}

export const PositionLeft: Story = {
  render: () => (
    <Tooltip content="Tooltip on left" side="left">
      <button
        type="button"
        className={css({
          padding: '0.5rem 1rem',
          backgroundColor: 'gray.600',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
        })}
      >
        Left
      </button>
    </Tooltip>
  ),
}

export const PositionRight: Story = {
  render: () => (
    <Tooltip content="Tooltip on right" side="right">
      <button
        type="button"
        className={css({
          padding: '0.5rem 1rem',
          backgroundColor: 'gray.600',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
        })}
      >
        Right
      </button>
    </Tooltip>
  ),
}

// =============================================================================
// Rich Content
// =============================================================================

const richContentStyles = {
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontWeight: 'bold',
    fontSize: '0.9375rem',
  }),
  emoji: css({
    fontSize: '1.125rem',
  }),
  description: css({
    color: 'gray.300',
    lineHeight: '1.5',
  }),
  detail: css({
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.375rem 0.5rem',
    backgroundColor: 'gray.800',
    borderRadius: '6px',
    fontSize: '0.8125rem',
  }),
  detailLabel: css({
    color: 'gray.400',
    fontWeight: '500',
  }),
  detailValue: css({
    color: 'white',
    fontFamily: 'mono',
  }),
}

export const RichContent: Story = {
  render: () => (
    <Tooltip
      content={
        <div className={richContentStyles.container}>
          <div className={richContentStyles.header}>
            <span className={richContentStyles.emoji}>🎯</span>
            <span>Focus Practice</span>
          </div>
          <p className={richContentStyles.description}>
            Building mastery of your current curriculum skills. These problems are at the heart of
            what you&apos;re learning right now.
          </p>
          <div className={richContentStyles.detail}>
            <span className={richContentStyles.detailLabel}>Distribution:</span>
            <span className={richContentStyles.detailValue}>60% of session</span>
          </div>
        </div>
      }
      side="bottom"
    >
      <span
        className={css({
          padding: '0.25rem 0.75rem',
          backgroundColor: 'blue.100',
          color: 'blue.700',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          cursor: 'help',
        })}
      >
        focus
      </span>
    </Tooltip>
  ),
}

export const RichContentReinforce: Story = {
  render: () => (
    <Tooltip
      content={
        <div className={richContentStyles.container}>
          <div className={richContentStyles.header}>
            <span className={richContentStyles.emoji}>💪</span>
            <span>Reinforcement</span>
          </div>
          <p className={richContentStyles.description}>
            Extra practice for skills that need more work. These problems target areas where
            accuracy has been below 70%.
          </p>
          <div className={richContentStyles.detail}>
            <span className={richContentStyles.detailLabel}>Targeting:</span>
            <span className={richContentStyles.detailValue}>5-complement for 4</span>
          </div>
          <div className={richContentStyles.detail}>
            <span className={richContentStyles.detailLabel}>Threshold:</span>
            <span
              className={css({
                padding: '0.125rem 0.375rem',
                backgroundColor: 'orange.900',
                color: 'orange.200',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
              })}
            >
              &lt;70% accuracy
            </span>
          </div>
        </div>
      }
      side="bottom"
    >
      <span
        className={css({
          padding: '0.25rem 0.75rem',
          backgroundColor: 'orange.100',
          color: 'orange.700',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          cursor: 'help',
        })}
      >
        reinforce
      </span>
    </Tooltip>
  ),
}

export const RichContentReview: Story = {
  render: () => (
    <Tooltip
      content={
        <div className={richContentStyles.container}>
          <div className={richContentStyles.header}>
            <span className={richContentStyles.emoji}>🔄</span>
            <span>Spaced Review</span>
          </div>
          <p className={richContentStyles.description}>
            Keeping mastered skills fresh through spaced repetition. Regular review prevents
            forgetting and strengthens long-term memory.
          </p>
          <div className={richContentStyles.detail}>
            <span className={richContentStyles.detailLabel}>Reviewing:</span>
            <span className={richContentStyles.detailValue}>add 3</span>
          </div>
          <div className={richContentStyles.detail}>
            <span className={richContentStyles.detailLabel}>Schedule:</span>
            <span className={richContentStyles.detailValue}>
              Mastered: 14 days &bull; Practicing: 7 days
            </span>
          </div>
        </div>
      }
      side="bottom"
    >
      <span
        className={css({
          padding: '0.25rem 0.75rem',
          backgroundColor: 'green.100',
          color: 'green.700',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          cursor: 'help',
        })}
      >
        review
      </span>
    </Tooltip>
  ),
}

export const RichContentChallenge: Story = {
  render: () => (
    <Tooltip
      content={
        <div className={richContentStyles.container}>
          <div className={richContentStyles.header}>
            <span className={richContentStyles.emoji}>⭐</span>
            <span>Mixed Practice</span>
          </div>
          <p className={richContentStyles.description}>
            Problems that combine multiple mastered skills. Great for building fluency and applying
            what you&apos;ve learned in new ways.
          </p>
          <div className={richContentStyles.detail}>
            <span className={richContentStyles.detailLabel}>Skills:</span>
            <span className={richContentStyles.detailValue}>All mastered</span>
          </div>
        </div>
      }
      side="bottom"
    >
      <span
        className={css({
          padding: '0.25rem 0.75rem',
          backgroundColor: 'purple.100',
          color: 'purple.700',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          cursor: 'help',
        })}
      >
        challenge
      </span>
    </Tooltip>
  ),
}

// =============================================================================
// All Purpose Badges Together
// =============================================================================

export const AllPurposeBadges: Story = {
  render: () => (
    <div className={css({ display: 'flex', gap: '1rem', flexWrap: 'wrap' })}>
      <Tooltip
        content={
          <div className={richContentStyles.container}>
            <div className={richContentStyles.header}>
              <span className={richContentStyles.emoji}>🎯</span>
              <span>Focus Practice</span>
            </div>
            <p className={richContentStyles.description}>
              Building mastery of your current curriculum skills.
            </p>
            <div className={richContentStyles.detail}>
              <span className={richContentStyles.detailLabel}>Distribution:</span>
              <span className={richContentStyles.detailValue}>60% of session</span>
            </div>
          </div>
        }
        side="bottom"
      >
        <span
          className={css({
            padding: '0.25rem 0.75rem',
            backgroundColor: 'blue.100',
            color: 'blue.700',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            cursor: 'help',
            transition: 'transform 0.15s ease',
            _hover: { transform: 'scale(1.05)' },
          })}
        >
          focus
        </span>
      </Tooltip>

      <Tooltip
        content={
          <div className={richContentStyles.container}>
            <div className={richContentStyles.header}>
              <span className={richContentStyles.emoji}>💪</span>
              <span>Reinforcement</span>
            </div>
            <p className={richContentStyles.description}>
              Extra practice for skills that need more work.
            </p>
            <div className={richContentStyles.detail}>
              <span className={richContentStyles.detailLabel}>Threshold:</span>
              <span
                className={css({
                  padding: '0.125rem 0.375rem',
                  backgroundColor: 'orange.900',
                  color: 'orange.200',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                })}
              >
                &lt;70% accuracy
              </span>
            </div>
          </div>
        }
        side="bottom"
      >
        <span
          className={css({
            padding: '0.25rem 0.75rem',
            backgroundColor: 'orange.100',
            color: 'orange.700',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            cursor: 'help',
            transition: 'transform 0.15s ease',
            _hover: { transform: 'scale(1.05)' },
          })}
        >
          reinforce
        </span>
      </Tooltip>

      <Tooltip
        content={
          <div className={richContentStyles.container}>
            <div className={richContentStyles.header}>
              <span className={richContentStyles.emoji}>🔄</span>
              <span>Spaced Review</span>
            </div>
            <p className={richContentStyles.description}>
              Keeping mastered skills fresh through spaced repetition.
            </p>
            <div className={richContentStyles.detail}>
              <span className={richContentStyles.detailLabel}>Schedule:</span>
              <span className={richContentStyles.detailValue}>14 / 7 days</span>
            </div>
          </div>
        }
        side="bottom"
      >
        <span
          className={css({
            padding: '0.25rem 0.75rem',
            backgroundColor: 'green.100',
            color: 'green.700',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            cursor: 'help',
            transition: 'transform 0.15s ease',
            _hover: { transform: 'scale(1.05)' },
          })}
        >
          review
        </span>
      </Tooltip>

      <Tooltip
        content={
          <div className={richContentStyles.container}>
            <div className={richContentStyles.header}>
              <span className={richContentStyles.emoji}>⭐</span>
              <span>Mixed Practice</span>
            </div>
            <p className={richContentStyles.description}>
              Problems that combine multiple mastered skills.
            </p>
            <div className={richContentStyles.detail}>
              <span className={richContentStyles.detailLabel}>Skills:</span>
              <span className={richContentStyles.detailValue}>All mastered</span>
            </div>
          </div>
        }
        side="bottom"
      >
        <span
          className={css({
            padding: '0.25rem 0.75rem',
            backgroundColor: 'purple.100',
            color: 'purple.700',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            cursor: 'help',
            transition: 'transform 0.15s ease',
            _hover: { transform: 'scale(1.05)' },
          })}
        >
          challenge
        </span>
      </Tooltip>
    </div>
  ),
}

// =============================================================================
// Dark Mode
// =============================================================================

export const DarkModeBadges: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  render: () => (
    <div className={css({ display: 'flex', gap: '1rem', flexWrap: 'wrap' })}>
      <Tooltip
        content={
          <div className={richContentStyles.container}>
            <div className={richContentStyles.header}>
              <span className={richContentStyles.emoji}>🎯</span>
              <span>Focus Practice</span>
            </div>
            <p className={richContentStyles.description}>
              Building mastery of your current curriculum skills.
            </p>
          </div>
        }
        side="bottom"
      >
        <span
          className={css({
            padding: '0.25rem 0.75rem',
            backgroundColor: 'blue.900',
            color: 'blue.200',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            cursor: 'help',
          })}
        >
          focus
        </span>
      </Tooltip>

      <Tooltip
        content={
          <div className={richContentStyles.container}>
            <div className={richContentStyles.header}>
              <span className={richContentStyles.emoji}>💪</span>
              <span>Reinforcement</span>
            </div>
            <p className={richContentStyles.description}>Extra practice for struggling skills.</p>
          </div>
        }
        side="bottom"
      >
        <span
          className={css({
            padding: '0.25rem 0.75rem',
            backgroundColor: 'orange.900',
            color: 'orange.200',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            cursor: 'help',
          })}
        >
          reinforce
        </span>
      </Tooltip>

      <Tooltip
        content={
          <div className={richContentStyles.container}>
            <div className={richContentStyles.header}>
              <span className={richContentStyles.emoji}>🔄</span>
              <span>Spaced Review</span>
            </div>
            <p className={richContentStyles.description}>Keeping mastered skills fresh.</p>
          </div>
        }
        side="bottom"
      >
        <span
          className={css({
            padding: '0.25rem 0.75rem',
            backgroundColor: 'green.900',
            color: 'green.200',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            cursor: 'help',
          })}
        >
          review
        </span>
      </Tooltip>

      <Tooltip
        content={
          <div className={richContentStyles.container}>
            <div className={richContentStyles.header}>
              <span className={richContentStyles.emoji}>⭐</span>
              <span>Mixed Practice</span>
            </div>
            <p className={richContentStyles.description}>Combining multiple mastered skills.</p>
          </div>
        }
        side="bottom"
      >
        <span
          className={css({
            padding: '0.25rem 0.75rem',
            backgroundColor: 'purple.900',
            color: 'purple.200',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            cursor: 'help',
          })}
        >
          challenge
        </span>
      </Tooltip>
    </div>
  ),
}

// =============================================================================
// Delay Variations
// =============================================================================

export const InstantTooltip: Story = {
  render: () => (
    <Tooltip content="I appear instantly!" delayDuration={0}>
      <button
        type="button"
        className={css({
          padding: '0.5rem 1rem',
          backgroundColor: 'green.500',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
        })}
      >
        No delay
      </button>
    </Tooltip>
  ),
}

export const SlowTooltip: Story = {
  render: () => (
    <Tooltip content="I take a while to appear..." delayDuration={1000}>
      <button
        type="button"
        className={css({
          padding: '0.5rem 1rem',
          backgroundColor: 'orange.500',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
        })}
      >
        1 second delay
      </button>
    </Tooltip>
  ),
}
