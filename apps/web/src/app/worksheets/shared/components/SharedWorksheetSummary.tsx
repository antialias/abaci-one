'use client'

import { css } from '@styled/css'
import { stack } from '@styled/patterns'
import { useTheme } from '@/contexts/ThemeContext'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { SETTING_ICONS } from '@/app/create/worksheets/utils/settingsSummary'

interface SharedWorksheetSummaryProps {
  config: WorksheetFormState
}

/**
 * Executive summary of worksheet configuration
 * Human-readable, visually appealing, shows only enabled features
 */
export function SharedWorksheetSummary({ config }: SharedWorksheetSummaryProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Build human-readable descriptions
  const operatorLabel = {
    addition: 'Addition',
    subtraction: 'Subtraction',
    multiplication: 'Multiplication',
    division: 'Division',
    mixed: 'Mixed Operations',
  }[config.operator]

  const digitRangeText =
    config.digitRange?.min === config.digitRange?.max
      ? `${config.digitRange.min}-digit numbers`
      : `${config.digitRange?.min || 1} to ${config.digitRange?.max || 2} digit numbers`

  const difficultyDescription = (() => {
    if (config.mode === 'smart') {
      const parts = ['Smart difficulty']
      if (config.interpolate) {
        parts.push('progresses from easy to hard')
      }
      if (config.pAnyStart != null) {
        const pct = Math.round(config.pAnyStart * 100)
        parts.push(`starting at ${pct}% challenge level`)
      }
      return parts.join(' • ')
    }
    if (config.mode === 'mastery') {
      return 'Mastery mode • Focused practice on specific skills'
    }
    return 'Manual difficulty • Custom settings'
  })()

  // Collect enabled visual aids
  const visualAids: string[] = []
  if (config.displayRules?.tenFrames === 'always') {
    visualAids.push('🎨 Ten-frame diagrams')
  }
  if (config.displayRules?.carryBoxes === 'always') {
    visualAids.push('📦 Carry notation boxes')
  }
  if (config.displayRules?.placeValueColors === 'always') {
    visualAids.push('🌈 Color-coded place values')
  }
  if (config.showAnswerBoxes) {
    visualAids.push('✏️ Answer entry boxes')
  }

  // Layout summary
  const layoutText = [
    `${config.problemsPerPage || 20} problems per page`,
    config.cols ? `${config.cols} columns` : null,
    config.pageSize ? config.pageSize.toUpperCase() : null,
    config.orientation ? config.orientation : null,
  ]
    .filter(Boolean)
    .join(' • ')

  return (
    <div
      data-component="shared-worksheet-summary"
      className={css({
        h: 'full',
        bg: isDark ? 'gray.800' : 'white',
        p: '5',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '5',
      })}
    >
      {/* Header */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: '4',
          borderBottom: '2px solid',
          borderColor: isDark ? 'blue.700' : 'blue.200',
        })}
      >
        <div>
          <h2
            className={css({
              fontSize: 'xl',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
              mb: '1',
            })}
          >
            📋 Worksheet Summary
          </h2>
          <p
            className={css({
              fontSize: 'sm',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            Read-only view of this shared worksheet
          </p>
        </div>
        <div
          className={css({
            px: '3',
            py: '1.5',
            rounded: 'lg',
            bg: isDark ? 'blue.700' : 'blue.100',
            fontSize: 'xs',
            fontWeight: 'bold',
            color: isDark ? 'blue.100' : 'blue.800',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
          })}
        >
          👁️ View Only
        </div>
      </div>

      {/* Student Name (if provided) */}
      {config.name && (
        <InfoCard icon="👤" title="Student" description={config.name} isDark={isDark} highlight />
      )}

      {/* Main Content */}
      <InfoCard
        icon={config.operator === 'mixed' ? '+−' : SETTING_ICONS.operator[config.operator]}
        title="What's Being Practiced"
        description={`${operatorLabel} with ${digitRangeText}`}
        isDark={isDark}
      />

      {/* Difficulty */}
      <InfoCard
        icon="🎯"
        title="Difficulty Level"
        description={difficultyDescription}
        isDark={isDark}
      />

      {/* Visual Aids (only if any enabled) */}
      {visualAids.length > 0 && (
        <div
          className={css({
            p: '4',
            bg: isDark ? 'gray.750' : 'gray.50',
            rounded: 'xl',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <h3
            className={css({
              fontSize: 'sm',
              fontWeight: 'bold',
              color: isDark ? 'gray.300' : 'gray.700',
              mb: '3',
              textTransform: 'uppercase',
              letterSpacing: 'wider',
            })}
          >
            🎨 Visual Learning Aids
          </h3>
          <div className={stack({ gap: '2' })}>
            {visualAids.map((aid, i) => (
              <div
                key={i}
                className={css({
                  fontSize: 'sm',
                  color: isDark ? 'gray.200' : 'gray.800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                })}
              >
                <span
                  className={css({
                    w: '6',
                    h: '6',
                    rounded: 'full',
                    bg: isDark ? 'gray.700' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'xs',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.300',
                  })}
                >
                  ✓
                </span>
                {aid}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layout Details */}
      <InfoCard icon="📐" title="Page Layout" description={layoutText} isDark={isDark} />

      {/* Additional Features (only if enabled) */}
      {(config.showDate || config.showNameField || config.includeAnswerKey) && (
        <div
          className={css({
            p: '4',
            bg: isDark ? 'gray.750' : 'gray.50',
            rounded: 'xl',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <h3
            className={css({
              fontSize: 'sm',
              fontWeight: 'bold',
              color: isDark ? 'gray.300' : 'gray.700',
              mb: '3',
              textTransform: 'uppercase',
              letterSpacing: 'wider',
            })}
          >
            ✨ Extras
          </h3>
          <div className={stack({ gap: '1.5' })}>
            {config.showDate && (
              <FeatureBadge icon="📅" label="Includes date field" isDark={isDark} />
            )}
            {config.showNameField && (
              <FeatureBadge icon="👤" label="Includes name field" isDark={isDark} />
            )}
            {config.includeAnswerKey && (
              <FeatureBadge icon="🔑" label="Answer key provided" isDark={isDark} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Large info card for primary information
 */
function InfoCard({
  icon,
  title,
  description,
  isDark,
  highlight = false,
}: {
  icon: string
  title: string
  description: string
  isDark: boolean
  highlight?: boolean
}) {
  return (
    <div
      data-element="info-card"
      className={css({
        p: '4',
        bg: highlight ? (isDark ? 'blue.900/20' : 'blue.50') : isDark ? 'gray.750' : 'gray.50',
        rounded: 'xl',
        border: '2px solid',
        borderColor: highlight
          ? isDark
            ? 'blue.700'
            : 'blue.200'
          : isDark
            ? 'gray.700'
            : 'gray.200',
      })}
    >
      <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '3' })}>
        <div
          className={css({
            fontSize: '2xl',
            flexShrink: 0,
            w: '12',
            h: '12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: isDark ? 'gray.700' : 'white',
            rounded: 'lg',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.300',
          })}
        >
          {icon}
        </div>
        <div className={css({ flex: 1, minW: 0 })}>
          <div
            className={css({
              fontSize: 'xs',
              fontWeight: 'bold',
              color: isDark ? 'gray.400' : 'gray.600',
              mb: '1',
              textTransform: 'uppercase',
              letterSpacing: 'wider',
            })}
          >
            {title}
          </div>
          <div
            className={css({
              fontSize: 'md',
              fontWeight: 'medium',
              color: isDark ? 'gray.100' : 'gray.900',
              lineHeight: '1.6',
            })}
          >
            {description}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Small feature badge for extras section
 */
function FeatureBadge({ icon, label, isDark }: { icon: string; label: string; isDark: boolean }) {
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '2',
        fontSize: 'sm',
        color: isDark ? 'gray.200' : 'gray.800',
      })}
    >
      <span className={css({ fontSize: 'lg' })}>{icon}</span>
      <span>{label}</span>
    </div>
  )
}
