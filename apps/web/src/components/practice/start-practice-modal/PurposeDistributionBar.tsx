'use client'

import { useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useTheme } from '@/contexts/ThemeContext'
import { useIsTouchDevice } from '@/hooks/useDeviceCapabilities'
import { purposeConfigs } from '../purposeExplanations'
import {
  useStartPracticeModal,
  PURPOSE_TYPES,
  type PurposeWeightType,
} from '../StartPracticeModalContext'
import { ProportionBar, type ProportionBarSegment } from './ProportionBar'
import { css } from '../../../../styled-system/css'

/**
 * Purpose-specific color palettes matching purposeExplanations.ts colors.
 * Each purpose uses its own color instead of the unified green used by practice modes.
 */
const PURPOSE_COLORS: Record<PurposeWeightType, ProportionBarSegment['colors']> = {
  focus: {
    // blue
    lightBg: 'rgba(37, 99, 235, 0.08)',
    lightBgBoosted: 'rgba(37, 99, 235, 0.15)',
    darkBg: 'rgba(59, 130, 246, 0.15)',
    darkBgBoosted: 'rgba(59, 130, 246, 0.25)',
    lightAccent: '#2563eb',
    darkAccent: '#60a5fa',
  },
  reinforce: {
    // orange
    lightBg: 'rgba(234, 88, 12, 0.08)',
    lightBgBoosted: 'rgba(234, 88, 12, 0.15)',
    darkBg: 'rgba(249, 115, 22, 0.15)',
    darkBgBoosted: 'rgba(249, 115, 22, 0.25)',
    lightAccent: '#ea580c',
    darkAccent: '#fb923c',
  },
  review: {
    // green
    lightBg: 'rgba(22, 163, 74, 0.08)',
    lightBgBoosted: 'rgba(22, 163, 74, 0.15)',
    darkBg: 'rgba(34, 197, 94, 0.15)',
    darkBgBoosted: 'rgba(34, 197, 94, 0.25)',
    lightAccent: '#16a34a',
    darkAccent: '#4ade80',
  },
  challenge: {
    // purple
    lightBg: 'rgba(147, 51, 234, 0.08)',
    lightBgBoosted: 'rgba(147, 51, 234, 0.15)',
    darkBg: 'rgba(168, 85, 247, 0.15)',
    darkBgBoosted: 'rgba(168, 85, 247, 0.25)',
    lightAccent: '#9333ea',
    darkAccent: '#c084fc',
  },
}

/** Solid accent colors for tooltip headers */
const PURPOSE_ACCENT_COLORS: Record<PurposeWeightType, string> = {
  focus: '#2563eb',
  reinforce: '#ea580c',
  review: '#16a34a',
  challenge: '#9333ea',
}

/** Rich tooltip card for a single purpose type */
function PurposeTooltipCard({
  purposeType,
  percentage,
  isDark,
}: {
  purposeType: PurposeWeightType
  percentage: number
  isDark: boolean
}) {
  const config = purposeConfigs[purposeType]
  const accentColor = PURPOSE_ACCENT_COLORS[purposeType]

  return (
    <div
      data-element="purpose-tooltip"
      className={css({
        width: '250px',
        borderRadius: '12px',
        overflow: 'hidden',
      })}
      style={{
        backgroundColor: isDark ? '#1e293b' : 'white',
        boxShadow: isDark
          ? '0 8px 30px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)'
          : '0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
      }}
    >
      {/* Color accent bar */}
      <div style={{ height: '3px', backgroundColor: accentColor }} />

      <div className={css({ padding: '12px 14px' })}>
        {/* Header row */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          })}
        >
          <span className={css({ fontSize: '1.375rem', lineHeight: 1 })}>{config.emoji}</span>
          <span
            className={css({ fontSize: '0.875rem', fontWeight: 'bold', lineHeight: 1.2 })}
            style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}
          >
            {config.label}
          </span>
          {percentage > 0 && (
            <span
              className={css({
                fontSize: '0.75rem',
                fontWeight: '600',
                marginLeft: 'auto',
                lineHeight: 1,
              })}
              style={{ color: accentColor }}
            >
              {percentage}%
            </span>
          )}
        </div>

        {/* Explanation */}
        <p
          className={css({
            fontSize: '0.8125rem',
            lineHeight: '1.5',
            margin: 0,
          })}
          style={{ color: isDark ? '#94a3b8' : '#64748b' }}
        >
          {config.explanation}
        </p>
      </div>
    </div>
  )
}

/** All-purposes info popover content (used on touch devices) */
function AllPurposesContent({
  purposeTimeWeights,
  isDark,
}: {
  purposeTimeWeights: Record<PurposeWeightType, number>
  isDark: boolean
}) {
  return (
    <div
      data-element="purpose-info-panel"
      className={css({
        width: '280px',
        borderRadius: '14px',
        overflow: 'hidden',
      })}
      style={{
        backgroundColor: isDark ? '#1e293b' : 'white',
        boxShadow: isDark
          ? '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)'
          : '0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header */}
      <div
        className={css({
          padding: '12px 14px 8px',
          fontSize: '0.75rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        })}
        style={{ color: isDark ? '#64748b' : '#94a3b8' }}
      >
        Problem Types
      </div>

      {/* Purpose cards */}
      {PURPOSE_TYPES.map(({ type }) => {
        const config = purposeConfigs[type]
        const accent = PURPOSE_ACCENT_COLORS[type]
        const pct = Math.round(purposeTimeWeights[type] * 100)

        return (
          <div
            key={type}
            className={css({
              padding: '10px 14px',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            })}
            style={{
              borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)',
            }}
          >
            {/* Accent dot + emoji */}
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0,
                paddingTop: '1px',
              })}
            >
              <span
                className={css({ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 })}
                style={{ backgroundColor: accent, opacity: pct > 0 ? 1 : 0.3 }}
              />
              <span className={css({ fontSize: '1rem', lineHeight: 1 })}>{config.emoji}</span>
            </div>

            {/* Text */}
            <div className={css({ flex: 1, minWidth: 0 })}>
              <div className={css({ display: 'flex', alignItems: 'baseline', gap: '6px' })}>
                <span
                  className={css({ fontSize: '0.8125rem', fontWeight: '600', lineHeight: 1.2 })}
                  style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}
                >
                  {config.shortLabel}
                </span>
                {pct > 0 && (
                  <span
                    className={css({ fontSize: '0.6875rem', fontWeight: '600', lineHeight: 1 })}
                    style={{ color: accent }}
                  >
                    {pct}%
                  </span>
                )}
              </div>
              <p
                className={css({ fontSize: '0.75rem', lineHeight: '1.4', margin: '3px 0 0' })}
                style={{ color: isDark ? '#94a3b8' : '#64748b', opacity: pct > 0 ? 1 : 0.5 }}
              >
                {config.shortExplanation}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Info button that opens a popover on touch / acts as hover target on desktop */
function PurposeInfoButton({
  purposeTimeWeights,
  isDark,
}: {
  purposeTimeWeights: Record<PurposeWeightType, number>
  isDark: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-element="purpose-info-trigger"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.625rem',
            fontWeight: 'bold',
            lineHeight: 1,
            transition: 'background-color 0.15s ease',
            '@media (max-width: 480px), (max-height: 700px)': {
              width: '14px',
              height: '14px',
              fontSize: '0.5625rem',
            },
          })}
          style={{
            color: isDark ? '#94a3b8' : '#94a3b8',
            backgroundColor: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.15)',
          }}
        >
          ?
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          sideOffset={8}
          align="start"
          className={css({ zIndex: 15000, outline: 'none' })}
        >
          <AllPurposesContent purposeTimeWeights={purposeTimeWeights} isDark={isDark} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Toggle between shuffled and in-order distribution */
function OrderToggle({
  shuffled,
  onToggle,
  isDark,
}: {
  shuffled: boolean
  onToggle: (shuffled: boolean) => void
  isDark: boolean
}) {
  return (
    <div
      data-element="order-toggle"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginTop: '6px',
        '@media (max-width: 480px), (max-height: 700px)': {
          marginTop: '4px',
        },
      })}
    >
      <span
        className={css({
          fontSize: '0.625rem',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        })}
        style={{ color: isDark ? '#64748b' : '#94a3b8' }}
      >
        Order:
      </span>
      <div
        className={css({
          display: 'inline-flex',
          borderRadius: '6px',
          overflow: 'hidden',
        })}
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        }}
      >
        {[
          { value: true, label: 'Mixed' },
          { value: false, label: 'In Order' },
        ].map(({ value, label }) => (
          <button
            key={label}
            type="button"
            data-option={`order-${label.toLowerCase().replace(' ', '-')}`}
            data-selected={shuffled === value}
            onClick={() => onToggle(value)}
            className={css({
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.625rem',
              fontWeight: '600',
              padding: '3px 8px',
              lineHeight: 1.2,
              transition: 'background-color 0.15s ease, color 0.15s ease',
              '@media (max-width: 480px), (max-height: 700px)': {
                fontSize: '0.5625rem',
                padding: '2px 6px',
              },
            })}
            style={{
              backgroundColor:
                shuffled === value
                  ? isDark
                    ? 'rgba(59, 130, 246, 0.2)'
                    : 'rgba(37, 99, 235, 0.1)'
                  : 'transparent',
              color:
                shuffled === value
                  ? isDark
                    ? '#60a5fa'
                    : '#2563eb'
                  : isDark
                    ? '#64748b'
                    : '#94a3b8',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function PurposeDistributionBar() {
  const {
    purposeWeights,
    cyclePurposeWeight,
    disablePurpose,
    purposeTimeWeights,
    shufflePurposes,
    setShufflePurposes,
  } = useStartPracticeModal()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const isTouchDevice = useIsTouchDevice()

  const enabledCount = useMemo(
    () => Object.values(purposeWeights).filter((w) => w > 0).length,
    [purposeWeights]
  )

  const segments = useMemo<ProportionBarSegment[]>(
    () =>
      PURPOSE_TYPES.map(({ type, emoji, label }) => ({
        key: type,
        emoji,
        label,
        weight: purposeWeights[type],
        colors: PURPOSE_COLORS[type],
        // Desktop: per-segment tooltip on hover
        tooltipContent: isTouchDevice ? undefined : (
          <PurposeTooltipCard
            purposeType={type}
            percentage={Math.round(purposeTimeWeights[type] * 100)}
            isDark={isDark}
          />
        ),
      })),
    [purposeWeights, purposeTimeWeights, isDark, isTouchDevice]
  )

  return (
    <div data-component="purpose-distribution-bar">
      <ProportionBar
        label="Problem Mix"
        labelExtra={
          <PurposeInfoButton purposeTimeWeights={purposeTimeWeights} isDark={isDark} />
        }
        dataSetting="purpose-distribution"
        segments={segments}
        onCycleWeight={(key) => cyclePurposeWeight(key as PurposeWeightType)}
        onDisable={(key) => disablePurpose(key as PurposeWeightType)}
        enabledCount={enabledCount}
      />
      <OrderToggle shuffled={shufflePurposes} onToggle={setShufflePurposes} isDark={isDark} />
    </div>
  )
}
