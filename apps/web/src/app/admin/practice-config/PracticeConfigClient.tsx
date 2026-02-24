'use client'

import { useCallback, useMemo, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { AdminNav } from '@/components/AdminNav'
import { useTheme } from '@/contexts/ThemeContext'
import {
  usePracticeConfig,
  useUpdatePracticeConfig,
  useResetPracticeConfig,
} from '@/hooks/usePracticeConfig'
import {
  computeTermCountRange,
  DEFAULT_TERM_COUNT_SCALING,
  validateTermCountScaling,
  type TermCountScalingConfig,
  type ModeScalingConfig,
} from '@/lib/curriculum/config/term-count-scaling'
import type { SessionPartType } from '@/db/schema/session-plans'
import { css } from '../../../../styled-system/css'

const MODE_LABELS: Record<SessionPartType, { emoji: string; label: string }> = {
  abacus: { emoji: '\u{1F9EE}', label: 'Abacus' },
  visualization: { emoji: '\u{1F9E0}', label: 'Visualization' },
  linear: { emoji: '\u{1F4AD}', label: 'Linear' },
}

const MODES: SessionPartType[] = ['abacus', 'visualization', 'linear']

export function PracticeConfigClient() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const { data, isLoading } = usePracticeConfig()
  const updateMutation = useUpdatePracticeConfig()
  const resetMutation = useResetPracticeConfig()

  // Local draft state for editing
  const [draft, setDraft] = useState<TermCountScalingConfig | null>(null)
  const [comfortSlider, setComfortSlider] = useState(30)

  // When data loads and we have no draft, initialize from server
  const serverConfig = data?.config ?? DEFAULT_TERM_COUNT_SCALING
  const editConfig = draft ?? serverConfig

  // Track if there are unsaved changes
  const hasChanges = draft !== null && JSON.stringify(draft) !== JSON.stringify(serverConfig)

  // Validation
  const validationError = useMemo(() => {
    if (!draft) return null
    return validateTermCountScaling(draft)
  }, [draft])

  // Comfort as 0-1 scale
  const comfort = comfortSlider / 100

  // Compute preview ranges for all modes at current comfort
  const previewRanges = useMemo(() => {
    const result: Record<SessionPartType, { min: number; max: number }> = {} as Record<
      SessionPartType,
      { min: number; max: number }
    >
    for (const mode of MODES) {
      result[mode] = computeTermCountRange(mode, comfort, editConfig)
    }
    return result
  }, [comfort, editConfig])

  // Floor/ceiling ranges from config (for display)
  const floorRanges = useMemo(() => {
    const result: Record<SessionPartType, { min: number; max: number }> = {} as Record<
      SessionPartType,
      { min: number; max: number }
    >
    for (const mode of MODES) {
      result[mode] = computeTermCountRange(mode, 0, editConfig)
    }
    return result
  }, [editConfig])

  const ceilingRanges = useMemo(() => {
    const result: Record<SessionPartType, { min: number; max: number }> = {} as Record<
      SessionPartType,
      { min: number; max: number }
    >
    for (const mode of MODES) {
      result[mode] = computeTermCountRange(mode, 1, editConfig)
    }
    return result
  }, [editConfig])

  const updateField = useCallback(
    (mode: SessionPartType, level: 'floor' | 'ceiling', bound: 'min' | 'max', value: number) => {
      const base = draft ?? { ...serverConfig }
      const updated: TermCountScalingConfig = {
        ...base,
        [mode]: {
          ...base[mode],
          [level]: {
            ...base[mode][level],
            [bound]: value,
          },
        },
      }
      setDraft(updated)
    },
    [draft, serverConfig]
  )

  const handleSave = useCallback(() => {
    if (!draft || validationError) return
    updateMutation.mutate(draft, {
      onSuccess: () => setDraft(null),
    })
  }, [draft, validationError, updateMutation])

  const handleReset = useCallback(() => {
    resetMutation.mutate(undefined, {
      onSuccess: () => setDraft(null),
    })
  }, [resetMutation])

  const handleRevertDraft = useCallback(() => {
    setDraft(null)
  }, [])

  // Styles
  const cardBg = isDark ? '#161b22' : '#f6f8fa'
  const cardBorder = isDark ? '#30363d' : '#d0d7de'
  const textPrimary = isDark ? '#f0f6fc' : '#1f2328'
  const textSecondary = isDark ? '#8b949e' : '#656d76'
  const accentBlue = '#58a6ff'
  const errorRed = '#f85149'

  if (isLoading) {
    return (
      <PageWithNav>
        <AdminNav />
        <div
          className={css({ padding: '24px', color: textSecondary })}
          data-component="practice-config-loading"
        >
          Loading practice config...
        </div>
      </PageWithNav>
    )
  }

  return (
    <PageWithNav>
      <AdminNav />
      <div
        className={css({
          maxWidth: '900px',
          margin: '0 auto',
          padding: '24px',
        })}
        data-component="practice-config-page"
      >
        {/* Header */}
        <h1
          className={css({
            fontSize: '24px',
            fontWeight: '600',
            color: textPrimary,
            marginBottom: '8px',
          })}
        >
          Term Count Scaling
        </h1>
        <p className={css({ fontSize: '14px', color: textSecondary, marginBottom: '24px' })}>
          Controls how many terms per problem (e.g. 2+3+4 = 3 terms) a student gets based on their
          comfort level per mode.
        </p>

        {/* Pipeline Visualization */}
        <PipelineVisualization
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          cardBg={cardBg}
          cardBorder={cardBorder}
        />

        {/* Interactive Preview */}
        <div
          className={css({
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px',
          })}
          data-component="comfort-preview"
        >
          <h2
            className={css({
              fontSize: '16px',
              fontWeight: '600',
              color: textPrimary,
              marginBottom: '16px',
            })}
          >
            Interactive Preview
          </h2>

          {/* Comfort Slider */}
          <div className={css({ marginBottom: '16px' })}>
            <label
              className={css({
                fontSize: '13px',
                fontWeight: '500',
                color: textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              })}
            >
              Comfort Level:
              <input
                type="range"
                min={0}
                max={100}
                value={comfortSlider}
                onChange={(e) => setComfortSlider(Number(e.target.value))}
                className={css({ flex: '1', cursor: 'pointer' })}
                data-element="comfort-slider"
              />
              <span className={css({ fontWeight: '700', color: textPrimary, minWidth: '40px' })}>
                {comfortSlider}%
              </span>
            </label>
          </div>

          {/* Results Table */}
          <table
            className={css({
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
            })}
          >
            <thead>
              <tr>
                <th
                  className={css({
                    textAlign: 'left',
                    padding: '8px',
                    color: textSecondary,
                    fontWeight: '500',
                  })}
                />
                <th
                  className={css({
                    textAlign: 'center',
                    padding: '8px',
                    color: textSecondary,
                    fontWeight: '500',
                  })}
                >
                  Struggling (0%)
                </th>
                <th
                  className={css({
                    textAlign: 'center',
                    padding: '8px',
                    color: accentBlue,
                    fontWeight: '600',
                  })}
                >
                  At {comfortSlider}%
                </th>
                <th
                  className={css({
                    textAlign: 'center',
                    padding: '8px',
                    color: textSecondary,
                    fontWeight: '500',
                  })}
                >
                  Mastered (100%)
                </th>
              </tr>
            </thead>
            <tbody>
              {MODES.map((mode) => (
                <tr key={mode}>
                  <td className={css({ padding: '8px', fontWeight: '500', color: textPrimary })}>
                    {MODE_LABELS[mode].emoji} {MODE_LABELS[mode].label}
                  </td>
                  <td
                    className={css({ textAlign: 'center', padding: '8px', color: textSecondary })}
                  >
                    {floorRanges[mode].min}–{floorRanges[mode].max}
                  </td>
                  <td
                    className={css({
                      textAlign: 'center',
                      padding: '8px',
                      fontWeight: '700',
                      color: accentBlue,
                    })}
                  >
                    {previewRanges[mode].min}–{previewRanges[mode].max}
                  </td>
                  <td
                    className={css({ textAlign: 'center', padding: '8px', color: textSecondary })}
                  >
                    {ceilingRanges[mode].min}–{ceilingRanges[mode].max}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Interpolation bars */}
          <div
            className={css({
              marginTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            })}
          >
            {MODES.map((mode) => (
              <InterpolationBar
                key={mode}
                mode={mode}
                comfort={comfort}
                floor={editConfig[mode].floor}
                ceiling={editConfig[mode].ceiling}
                preview={previewRanges[mode]}
                isDark={isDark}
                textSecondary={textSecondary}
              />
            ))}
          </div>
        </div>

        {/* Per-Mode Config Cards */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginBottom: '24px',
          })}
        >
          {MODES.map((mode) => (
            <ModeConfigCard
              key={mode}
              mode={mode}
              config={editConfig[mode]}
              onChange={(level, bound, value) => updateField(mode, level, bound, value)}
              comfort={comfort}
              preview={previewRanges[mode]}
              isDark={isDark}
              cardBg={cardBg}
              cardBorder={cardBorder}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              accentBlue={accentBlue}
              errorRed={errorRed}
            />
          ))}
        </div>

        {/* Validation Error */}
        {validationError && (
          <div
            className={css({
              padding: '12px 16px',
              borderRadius: '6px',
              background: isDark ? '#2d1215' : '#ffebe9',
              border: `1px solid ${errorRed}`,
              color: errorRed,
              fontSize: '13px',
              marginBottom: '16px',
            })}
            data-element="validation-error"
          >
            {validationError}
          </div>
        )}

        {/* Save Controls */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          })}
          data-component="save-controls"
        >
          <button
            onClick={handleSave}
            disabled={!hasChanges || !!validationError || updateMutation.isPending}
            className={css({
              padding: '8px 20px',
              borderRadius: '6px',
              border: 'none',
              background: hasChanges && !validationError ? '#238636' : '#21262d',
              color: hasChanges && !validationError ? '#fff' : '#8b949e',
              fontSize: '14px',
              fontWeight: '500',
              cursor: hasChanges && !validationError ? 'pointer' : 'not-allowed',
              opacity: updateMutation.isPending ? '0.7' : '1',
            })}
            data-action="save"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            onClick={handleReset}
            disabled={resetMutation.isPending || (!data?.isCustom && !hasChanges)}
            className={css({
              padding: '8px 20px',
              borderRadius: '6px',
              border: `1px solid ${cardBorder}`,
              background: 'transparent',
              color: textSecondary,
              fontSize: '14px',
              fontWeight: '500',
              cursor: data?.isCustom || hasChanges ? 'pointer' : 'not-allowed',
              opacity: data?.isCustom || hasChanges ? '1' : '0.5',
            })}
            data-action="reset-defaults"
          >
            {resetMutation.isPending ? 'Resetting...' : 'Reset to Defaults'}
          </button>

          {hasChanges && (
            <button
              onClick={handleRevertDraft}
              className={css({
                padding: '8px 20px',
                borderRadius: '6px',
                border: `1px solid ${cardBorder}`,
                background: 'transparent',
                color: textSecondary,
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              })}
              data-action="discard"
            >
              Discard Changes
            </button>
          )}

          {hasChanges && (
            <span className={css({ fontSize: '13px', color: '#d29922' })}>
              You have unsaved changes
            </span>
          )}

          {data?.isCustom && !hasChanges && (
            <span className={css({ fontSize: '13px', color: textSecondary })}>
              Using custom config
            </span>
          )}
        </div>

        {/* How It Works Section */}
        <HowItWorks
          isDark={isDark}
          cardBg={cardBg}
          cardBorder={cardBorder}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
      </div>
    </PageWithNav>
  )
}

// =============================================================================
// Pipeline Visualization
// =============================================================================

function PipelineVisualization({
  isDark,
  textPrimary,
  textSecondary,
  cardBg,
  cardBorder,
}: {
  isDark: boolean
  textPrimary: string
  textSecondary: string
  cardBg: string
  cardBorder: string
}) {
  const steps = [
    { title: 'BKT Mastery', detail: 'per-skill pKnown\nweighted avg' },
    { title: 'Comfort Level', detail: '0–1 scale\n× mode mult.' },
    { title: 'This Config', detail: 'floor ↔ ceiling\nlinear interp.' },
    { title: 'Term Count', detail: 'per problem\nrandom in range' },
  ]

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '4px',
      })}
      data-component="pipeline-viz"
    >
      {steps.map((step, i) => (
        <div
          key={step.title}
          className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}
        >
          <div
            className={css({
              background: cardBg,
              border: `1px solid ${i === 2 ? '#58a6ff' : cardBorder}`,
              borderRadius: '8px',
              padding: '12px 16px',
              minWidth: '130px',
              textAlign: 'center',
            })}
          >
            <div
              className={css({
                fontSize: '13px',
                fontWeight: '600',
                color: textPrimary,
                marginBottom: '4px',
              })}
            >
              {step.title}
            </div>
            <div
              className={css({
                fontSize: '11px',
                color: textSecondary,
                whiteSpace: 'pre-line',
                lineHeight: '1.4',
              })}
            >
              {step.detail}
            </div>
          </div>
          {i < steps.length - 1 && (
            <span className={css({ color: textSecondary, fontSize: '16px', flexShrink: '0' })}>
              →
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// Interpolation Bar
// =============================================================================

function InterpolationBar({
  mode,
  comfort,
  floor,
  ceiling,
  preview,
  isDark,
  textSecondary,
}: {
  mode: SessionPartType
  comfort: number
  floor: { min: number; max: number }
  ceiling: { min: number; max: number }
  preview: { min: number; max: number }
  isDark: boolean
  textSecondary: string
}) {
  const { emoji, label } = MODE_LABELS[mode]
  const pct = Math.round(comfort * 100)

  return (
    <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
      <span className={css({ fontSize: '12px', color: textSecondary, minWidth: '100px' })}>
        {emoji} {label}
      </span>
      <div
        className={css({
          flex: '1',
          height: '12px',
          borderRadius: '6px',
          background: isDark
            ? 'linear-gradient(to right, #1a3a2a, #0d4429, #238636)'
            : 'linear-gradient(to right, #ffebe9, #fff8c5, #dafbe1)',
          position: 'relative',
        })}
      >
        {/* Marker at comfort position */}
        <div
          className={css({
            position: 'absolute',
            top: '-2px',
            width: '4px',
            height: '16px',
            borderRadius: '2px',
            background: '#58a6ff',
            transition: 'left 0.15s ease',
          })}
          style={{ left: `calc(${pct}% - 2px)` }}
        />
      </div>
      <span
        className={css({
          fontSize: '11px',
          color: textSecondary,
          minWidth: '50px',
          textAlign: 'right',
        })}
      >
        {preview.min}–{preview.max}
      </span>
    </div>
  )
}

// =============================================================================
// Mode Config Card
// =============================================================================

function ModeConfigCard({
  mode,
  config,
  onChange,
  comfort,
  preview,
  isDark,
  cardBg,
  cardBorder,
  textPrimary,
  textSecondary,
  accentBlue,
  errorRed,
}: {
  mode: SessionPartType
  config: ModeScalingConfig
  onChange: (level: 'floor' | 'ceiling', bound: 'min' | 'max', value: number) => void
  comfort: number
  preview: { min: number; max: number }
  isDark: boolean
  cardBg: string
  cardBorder: string
  textPrimary: string
  textSecondary: string
  accentBlue: string
  errorRed: string
}) {
  const { emoji, label } = MODE_LABELS[mode]

  // Per-field validation
  const errors: string[] = []
  if (config.floor.min > config.floor.max) errors.push('Floor min must be ≤ floor max')
  if (config.ceiling.min > config.ceiling.max) errors.push('Ceiling min must be ≤ ceiling max')
  if (config.floor.min > config.ceiling.min) errors.push('Floor min must be ≤ ceiling min')
  if (config.floor.max > config.ceiling.max) errors.push('Floor max must be ≤ ceiling max')

  return (
    <div
      className={css({
        background: cardBg,
        border: `1px solid ${errors.length > 0 ? errorRed : cardBorder}`,
        borderRadius: '8px',
        padding: '20px',
      })}
      data-component={`mode-card-${mode}`}
    >
      <h3
        className={css({
          fontSize: '15px',
          fontWeight: '600',
          color: textPrimary,
          marginBottom: '16px',
        })}
      >
        {emoji} {label}
      </h3>

      <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' })}>
        {/* Floor (Struggling) */}
        <div>
          <div
            className={css({
              fontSize: '12px',
              fontWeight: '600',
              color: textSecondary,
              marginBottom: '12px',
            })}
          >
            Struggling (0% comfort)
          </div>
          <NumberStepper
            label="Min terms"
            value={config.floor.min}
            onChange={(v) => onChange('floor', 'min', v)}
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            cardBorder={cardBorder}
          />
          <NumberStepper
            label="Max terms"
            value={config.floor.max}
            onChange={(v) => onChange('floor', 'max', v)}
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            cardBorder={cardBorder}
          />
        </div>

        {/* Ceiling (Mastered) */}
        <div>
          <div
            className={css({
              fontSize: '12px',
              fontWeight: '600',
              color: textSecondary,
              marginBottom: '12px',
            })}
          >
            Mastered (100% comfort)
          </div>
          <NumberStepper
            label="Min terms"
            value={config.ceiling.min}
            onChange={(v) => onChange('ceiling', 'min', v)}
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            cardBorder={cardBorder}
          />
          <NumberStepper
            label="Max terms"
            value={config.ceiling.max}
            onChange={(v) => onChange('ceiling', 'max', v)}
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            cardBorder={cardBorder}
          />
        </div>
      </div>

      {/* Preview bar */}
      <div
        className={css({ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' })}
      >
        <span className={css({ fontSize: '11px', color: textSecondary })}>
          {config.floor.min}–{config.floor.max}
        </span>
        <div
          className={css({
            flex: '1',
            height: '8px',
            borderRadius: '4px',
            background: isDark
              ? 'linear-gradient(to right, #1a3a2a, #238636)'
              : 'linear-gradient(to right, #ffebe9, #dafbe1)',
            position: 'relative',
          })}
        >
          <div
            className={css({
              position: 'absolute',
              top: '-4px',
              width: '3px',
              height: '16px',
              borderRadius: '2px',
              background: accentBlue,
              transition: 'left 0.15s ease',
            })}
            style={{ left: `calc(${Math.round(comfort * 100)}% - 1.5px)` }}
          />
        </div>
        <span className={css({ fontSize: '11px', color: textSecondary })}>
          {config.ceiling.min}–{config.ceiling.max}
        </span>
        <span
          className={css({
            fontSize: '12px',
            fontWeight: '600',
            color: accentBlue,
            marginLeft: '4px',
          })}
        >
          {preview.min}–{preview.max}
        </span>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className={css({ marginTop: '12px', fontSize: '12px', color: errorRed })}>
          {errors.map((err) => (
            <div key={err}>{err}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Number Stepper
// =============================================================================

function NumberStepper({
  label,
  value,
  onChange,
  isDark,
  textPrimary,
  textSecondary,
  cardBorder,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  isDark: boolean
  textPrimary: string
  textSecondary: string
  cardBorder: string
}) {
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      })}
    >
      <span className={css({ fontSize: '12px', color: textSecondary, minWidth: '70px' })}>
        {label}:
      </span>
      <div className={css({ display: 'flex', alignItems: 'center', gap: '0' })}>
        <button
          onClick={() => onChange(Math.max(2, value - 1))}
          className={css({
            width: '28px',
            height: '28px',
            border: `1px solid ${cardBorder}`,
            borderRadius: '4px 0 0 4px',
            background: isDark ? '#21262d' : '#f6f8fa',
            color: textPrimary,
            fontSize: '14px',
            cursor: value <= 2 ? 'not-allowed' : 'pointer',
            opacity: value <= 2 ? '0.4' : '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          })}
          disabled={value <= 2}
          data-action="decrement"
        >
          −
        </button>
        <input
          type="number"
          min={2}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v)) onChange(Math.max(2, v))
          }}
          className={css({
            width: '44px',
            height: '28px',
            border: `1px solid ${cardBorder}`,
            borderLeft: 'none',
            borderRight: 'none',
            background: isDark ? '#0d1117' : '#fff',
            color: textPrimary,
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: '600',
            outline: 'none',
            appearance: 'textfield',
          })}
          data-element="stepper-input"
        />
        <button
          onClick={() => onChange(value + 1)}
          className={css({
            width: '28px',
            height: '28px',
            border: `1px solid ${cardBorder}`,
            borderRadius: '0 4px 4px 0',
            background: isDark ? '#21262d' : '#f6f8fa',
            color: textPrimary,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          })}
          data-action="increment"
        >
          +
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// How It Works
// =============================================================================

function HowItWorks({
  isDark,
  cardBg,
  cardBorder,
  textPrimary,
  textSecondary,
}: {
  isDark: boolean
  cardBg: string
  cardBorder: string
  textPrimary: string
  textSecondary: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={css({ marginTop: '32px' })} data-component="how-it-works">
      <button
        onClick={() => setOpen(!open)}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0',
          border: 'none',
          background: 'none',
          color: textSecondary,
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
        })}
        data-action="toggle-how-it-works"
      >
        <span
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        >
          ▶
        </span>
        How It Works
      </button>

      {open && (
        <div
          className={css({
            marginTop: '12px',
            padding: '20px',
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: '8px',
            fontSize: '13px',
            lineHeight: '1.7',
            color: textSecondary,
          })}
        >
          <ol
            className={css({
              paddingLeft: '20px',
              margin: '0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            })}
          >
            <li>
              <strong className={css({ color: textPrimary })}>BKT</strong> tracks per-skill mastery
              (pKnown) from problem history, independently per mode.
            </li>
            <li>
              <strong className={css({ color: textPrimary })}>Comfort level</strong> (0–1)
              aggregates pKnown across practicing skills.
              <ul className={css({ paddingLeft: '20px', marginTop: '4px' })}>
                <li>Session mode scales: remediation ×0.6, progression ×0.85, maintenance ×1.0</li>
                <li>Problem length preference shifts: shorter −0.3, recommended ±0, longer +0.2</li>
              </ul>
            </li>
            <li>
              <strong className={css({ color: textPrimary })}>This config</strong> defines term
              counts at comfort=0 (floor) vs comfort=1 (ceiling).
            </li>
            <li>
              <strong className={css({ color: textPrimary })}>Linear interpolation</strong> between
              floor and ceiling:{' '}
              <code
                className={css({
                  fontSize: '12px',
                  background: isDark ? '#21262d' : '#f0f0f0',
                  padding: '1px 4px',
                  borderRadius: '3px',
                })}
              >
                round(floor + (ceiling - floor) × comfort)
              </code>
            </li>
            <li>
              Problem generator picks a random term count within the resulting {'{'} min, max {'}'}{' '}
              range.
            </li>
          </ol>
          <div
            className={css({
              marginTop: '16px',
              padding: '12px',
              background: isDark ? '#0d1117' : '#f6f8fa',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'monospace',
            })}
          >
            <strong>Example at 30% comfort on Abacus (defaults):</strong>
            <br />
            min = round(2 + (4−2) × 0.3) = 3
            <br />
            max = round(3 + (8−3) × 0.3) = 5
            <br />→ problems have 3–5 terms
          </div>
        </div>
      )}
    </div>
  )
}
