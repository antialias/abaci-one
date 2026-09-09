'use client'

import * as Popover from '@radix-ui/react-popover'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../styled-system/css'

const DISABLED_PERCENT_3 = 25
const DISABLED_PERCENT_4 = 15

/** Shared styles for the +/× toggle badge in the top-left corner */
const toggleBadgeClass = css({
  position: 'absolute',
  top: '4px',
  left: '4px',
  width: '22px',
  height: '22px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.875rem',
  fontWeight: 'bold',
  borderRadius: '50%',
  lineHeight: 1,
  transition: 'transform 0.25s ease, background-color 0.2s ease, color 0.2s ease',
  '@media (max-width: 480px), (max-height: 700px)': {
    top: '3px',
    left: '3px',
    width: '18px',
    height: '18px',
    fontSize: '0.75rem',
  },
})

/** Tooltip portal content styles */
const tooltipPortalClass = css({
  zIndex: 15000,
  outline: 'none',
})

/** Popover card for a locked segment's "why" note */
const lockedPopoverClass = css({
  zIndex: 15000,
  outline: 'none',
  maxWidth: '280px',
  padding: '0.75rem 0.875rem',
  borderRadius: '12px',
  fontSize: '0.8125rem',
  lineHeight: 1.4,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
})

/**
 * A segment the student can't turn on yet. It stays live (no `disabled`): tapping it
 * opens a short note on why, instead of cycling the weight.
 */
export interface ProportionBarLock {
  /** Popover body: the reason and, optionally, where to go to work on it */
  content: React.ReactNode
  /** Accessible label for the locked control (defaults to "<label> locked") */
  ariaLabel?: string
}

export interface ProportionBarSegment {
  key: string
  emoji: string
  label: string
  weight: number
  /** Optional badge in top-right (e.g., problem count) */
  badgeContent?: React.ReactNode
  /** Optional rich tooltip content shown on hover (desktop) */
  tooltipContent?: React.ReactNode
  /** When set, the segment renders locked (🔒, muted) and tapping opens the note */
  locked?: ProportionBarLock
  /** Color for enabled state: [lightBg, lightBgBoosted, darkBg, darkBgBoosted] */
  colors: {
    lightBg: string
    lightBgBoosted: string
    darkBg: string
    darkBgBoosted: string
    lightAccent: string
    darkAccent: string
  }
}

interface ProportionBarProps {
  /** Section label above the bar */
  label: string
  /** Optional extra content rendered inline after the label (e.g., info button) */
  labelExtra?: React.ReactNode
  /** data-setting attribute for the outer div */
  dataSetting: string
  /** Segment definitions */
  segments: ProportionBarSegment[]
  /** Called when a segment is tapped (cycle weight) */
  onCycleWeight: (key: string) => void
  /** Called when a segment's × is tapped (disable) */
  onDisable: (key: string) => void
  /** Number of currently enabled segments */
  enabledCount: number
}

export function ProportionBar({
  label,
  labelExtra,
  dataSetting,
  segments,
  onCycleWeight,
  onDisable,
  enabledCount,
}: ProportionBarProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const disabledPercent = segments.length <= 3 ? DISABLED_PERCENT_3 : DISABLED_PERCENT_4
  const disabledCount = segments.filter((s) => s.weight === 0 || s.locked).length
  const reservedPercent = disabledCount * disabledPercent
  const activeTotal = segments.reduce((sum, s) => sum + (s.locked ? 0 : s.weight), 0)
  const remainingPercent = 100 - reservedPercent

  // Only show ×2 when active segments have mixed weights
  const activeWeights = segments.filter((s) => s.weight > 0 && !s.locked).map((s) => s.weight)
  const hasMixedWeights = activeWeights.length >= 2 && new Set(activeWeights).size > 1

  return (
    <div data-setting={dataSetting}>
      <div
        data-element="bar-label"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.6875rem',
          fontWeight: '600',
          color: isDark ? 'gray.500' : 'gray.400',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
          '@media (max-width: 480px), (max-height: 700px)': {
            marginBottom: '0.25rem',
            fontSize: '0.625rem',
          },
        })}
      >
        {label}
        {labelExtra}
      </div>
      <div
        data-element="proportion-bar"
        className={css({
          display: 'flex',
          gap: '2px',
          borderRadius: '12px',
          overflow: 'hidden',
          height: '56px',
          '@media (max-width: 480px), (max-height: 700px)': {
            height: '44px',
            borderRadius: '10px',
          },
        })}
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        }}
      >
        {segments.map((segment) => {
          if (segment.locked) {
            return (
              <LockedSegment
                key={segment.key}
                segment={segment}
                lock={segment.locked}
                widthPercent={disabledPercent}
                isDark={isDark}
              />
            )
          }
          const isEnabled = segment.weight > 0
          const isLastActive = isEnabled && enabledCount === 1

          const widthPercent =
            segment.weight === 0
              ? disabledPercent
              : activeTotal > 0
                ? (remainingPercent * segment.weight) / activeTotal
                : 0

          const bgColor = isEnabled
            ? isDark
              ? segment.weight >= 2
                ? segment.colors.darkBgBoosted
                : segment.colors.darkBg
              : segment.weight >= 2
                ? segment.colors.lightBgBoosted
                : segment.colors.lightBg
            : 'transparent'

          const buttonClassName = css({
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            border: 'none',
            cursor: 'pointer',
            transition: 'width 0.2s ease, background-color 0.15s ease, opacity 0.15s ease',
            padding: '0 0.25rem',
            '@media (max-width: 480px), (max-height: 700px)': {
              padding: '0 0.125rem',
            },
          })

          const buttonStyle = {
            width: `${widthPercent}%`,
            backgroundColor: bgColor,
            opacity: isEnabled ? 1 : 0.5,
          }

          const buttonChildren = (
            <>
              {/* Optional badge — top-right */}
              {isEnabled && segment.badgeContent && (
                <span
                  data-element="problem-badge"
                  className={css({
                    position: 'absolute',
                    top: '2px',
                    right: '4px',
                    minWidth: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6875rem',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: 'green.500',
                    borderRadius: '10px',
                    padding: '0 4px',
                    '@media (max-width: 480px), (max-height: 700px)': {
                      top: '1px',
                      right: '2px',
                      minWidth: '16px',
                      height: '16px',
                      fontSize: '0.5625rem',
                      borderRadius: '8px',
                      padding: '0 3px',
                    },
                  })}
                >
                  {segment.badgeContent}
                </span>
              )}
              {/* Toggle badge — top-left: "+" (0°) to add, rotates 45° to become "×" to remove */}
              {!isLastActive && (
                <span
                  data-element={isEnabled ? 'remove-hint' : 'add-hint'}
                  data-action={isEnabled ? 'disable-mode' : undefined}
                  role={isEnabled ? 'button' : undefined}
                  tabIndex={isEnabled ? 0 : undefined}
                  onClick={
                    isEnabled
                      ? (e: React.MouseEvent) => {
                          e.stopPropagation()
                          onDisable(segment.key)
                        }
                      : undefined
                  }
                  onKeyDown={
                    isEnabled
                      ? (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation()
                            e.preventDefault()
                            onDisable(segment.key)
                          }
                        }
                      : undefined
                  }
                  className={toggleBadgeClass}
                  style={{
                    transform: isEnabled ? 'rotate(45deg)' : 'rotate(0deg)',
                    color: isEnabled
                      ? isDark
                        ? '#f87171'
                        : '#dc2626'
                      : isDark
                        ? '#e2e8f0'
                        : '#334155',
                    backgroundColor: isEnabled
                      ? isDark
                        ? 'rgba(248, 113, 113, 0.15)'
                        : 'rgba(220, 38, 38, 0.1)'
                      : isDark
                        ? 'rgba(34, 197, 94, 0.3)'
                        : 'rgba(22, 163, 74, 0.15)',
                    cursor: isEnabled ? 'pointer' : undefined,
                  }}
                >
                  +
                </span>
              )}
              {/* Emoji */}
              <span
                className={css({
                  fontSize: '1.25rem',
                  lineHeight: 1,
                  flexShrink: 0,
                  '@media (max-width: 480px), (max-height: 700px)': {
                    fontSize: '1rem',
                  },
                })}
              >
                {segment.emoji}
              </span>
              {/* Label row: label + optional ×N badge */}
              <span
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  maxWidth: '100%',
                  overflow: 'hidden',
                })}
              >
                <span
                  data-element="segment-label"
                  className={css({
                    fontSize: '0.625rem',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.2,
                    '@media (max-width: 480px), (max-height: 700px)': {
                      fontSize: '0.5625rem',
                    },
                  })}
                  style={{
                    color: isEnabled
                      ? isDark
                        ? '#e2e8f0'
                        : '#334155'
                      : isDark
                        ? '#94a3b8'
                        : '#94a3b8',
                  }}
                >
                  {segment.label}
                </span>
                {/* ×N badge — only when weights are mixed and this segment is boosted */}
                {segment.weight >= 2 && hasMixedWeights && (
                  <span
                    data-element="weight-label"
                    className={css({
                      fontSize: '0.5625rem',
                      fontWeight: 'bold',
                      lineHeight: 1,
                      flexShrink: 0,
                      '@media (max-width: 480px), (max-height: 700px)': {
                        fontSize: '0.5rem',
                      },
                    })}
                    style={{
                      color: isDark ? segment.colors.darkAccent : segment.colors.lightAccent,
                    }}
                  >
                    ×{segment.weight}
                  </span>
                )}
              </span>
            </>
          )

          if (segment.tooltipContent) {
            return (
              <TooltipPrimitive.Provider key={segment.key}>
                <TooltipPrimitive.Root delayDuration={400}>
                  <TooltipPrimitive.Trigger asChild>
                    <button
                      type="button"
                      data-option={`segment-${segment.key}`}
                      data-enabled={isEnabled}
                      data-weight={segment.weight}
                      onClick={() => onCycleWeight(segment.key)}
                      className={buttonClassName}
                      style={buttonStyle}
                    >
                      {buttonChildren}
                    </button>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                      side="bottom"
                      sideOffset={8}
                      className={tooltipPortalClass}
                    >
                      {segment.tooltipContent}
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
              </TooltipPrimitive.Provider>
            )
          }

          return (
            <button
              key={segment.key}
              type="button"
              data-option={`segment-${segment.key}`}
              data-enabled={isEnabled}
              data-weight={segment.weight}
              onClick={() => onCycleWeight(segment.key)}
              className={buttonClassName}
              style={buttonStyle}
            >
              {buttonChildren}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LockedSegment({
  segment,
  lock,
  widthPercent,
  isDark,
}: {
  segment: ProportionBarSegment
  lock: ProportionBarLock
  widthPercent: number
  isDark: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-option={`segment-${segment.key}`}
          data-element="mode-segment-locked"
          data-part={segment.key}
          data-enabled={false}
          data-weight={0}
          data-locked="true"
          aria-label={lock.ariaLabel ?? `${segment.label} locked`}
          aria-expanded={open}
          className={css({
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            border: 'none',
            cursor: 'pointer',
            transition: 'width 0.2s ease, background-color 0.15s ease, opacity 0.15s ease',
            padding: '0 0.25rem',
            '@media (max-width: 480px), (max-height: 700px)': {
              padding: '0 0.125rem',
            },
          })}
          style={{
            width: `${widthPercent}%`,
            backgroundColor: 'transparent',
            opacity: 0.7,
          }}
        >
          <span
            data-element="lock-glyph"
            aria-hidden
            className={css({
              fontSize: '1.25rem',
              lineHeight: 1,
              flexShrink: 0,
              '@media (max-width: 480px), (max-height: 700px)': {
                fontSize: '1rem',
              },
            })}
          >
            🔒
          </span>
          <span
            data-element="segment-label"
            className={css({
              fontSize: '0.625rem',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
              '@media (max-width: 480px), (max-height: 700px)': {
                fontSize: '0.5625rem',
              },
            })}
            style={{ color: '#94a3b8' }}
          >
            {segment.label}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          sideOffset={8}
          align="center"
          collisionPadding={12}
          data-element="mode-segment-locked-note"
          data-part={segment.key}
          className={lockedPopoverClass}
          style={{
            backgroundColor: isDark ? '#1e293b' : 'white',
            color: isDark ? '#e2e8f0' : '#334155',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          {lock.content}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
