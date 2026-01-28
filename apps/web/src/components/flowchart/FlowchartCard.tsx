'use client'

import Link from 'next/link'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'
import { AnimatedBackgroundTiles } from './AnimatedBackgroundTiles'
import { DiagnosticBadge } from './FlowchartDiagnostics'
import type { GeneratedExample } from '@/lib/flowcharts/loader'
import type { ExecutableFlowchart } from '@/lib/flowcharts/schema'
import type { DiagnosticReport } from '@/lib/flowcharts/doctor'

export interface FlowchartCardAction {
  label: string
  /** Click handler - use this for actions that don't navigate */
  onClick?: () => void
  /** href - use this for navigation (renders as Link, takes precedence over onClick) */
  href?: string
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

export interface FlowchartCardProps {
  /** Title of the flowchart */
  title: string
  /** Optional description */
  description?: string
  /** Optional emoji icon */
  emoji?: string
  /** Optional difficulty badge */
  difficulty?: string
  /** Optional status badge (e.g., "draft", "published") */
  status?: string
  /** Optional subtitle text (e.g., last updated date) */
  subtitle?: string
  /** Click handler for the main card */
  onClick?: () => void
  /** Optional secondary actions */
  actions?: FlowchartCardAction[]
  /** Optional flowchart for animated background tiles (needed for formatting) */
  flowchart?: ExecutableFlowchart
  /** Optional examples for animated background tiles */
  examples?: GeneratedExample[]
  /** Optional diagnostic report to show health badge */
  diagnosticReport?: DiagnosticReport
}

/**
 * Shared card component for displaying flowcharts in lists.
 * Used on /flowchart for built-in flowcharts and /workshop for in-progress sessions.
 */
export function FlowchartCard({
  title,
  description,
  emoji,
  difficulty,
  status,
  subtitle,
  onClick,
  actions,
  flowchart,
  examples,
  diagnosticReport,
}: FlowchartCardProps) {
  const hasActions = actions && actions.length > 0
  // Only show animated background if flowchart has examples AND is healthy (cleared by doctor)
  const isHealthy = !diagnosticReport || diagnosticReport.isHealthy
  const hasExamples = flowchart && examples && examples.length > 0 && isHealthy

  const cardContent = (
    <div className={hstack({ gap: '4', alignItems: 'flex-start', flex: 1, minWidth: 0 })}>
      {emoji && <span className={css({ fontSize: '3xl', flexShrink: 0 })}>{emoji}</span>}
      <div className={vstack({ gap: '1', alignItems: 'flex-start', flex: 1, minWidth: 0 })}>
        <h2
          className={css({
            fontSize: 'lg',
            fontWeight: 'semibold',
            color: { base: 'gray.900', _dark: 'gray.100' },
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
          })}
        >
          {title}
        </h2>
        {description && (
          <p
            className={css({
              fontSize: 'sm',
              color: { base: 'gray.600', _dark: 'gray.400' },
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineClamp: 2,
            })}
          >
            {description}
          </p>
        )}
        <div className={hstack({ gap: '2', marginTop: '1', flexWrap: 'wrap' })}>
          {difficulty && (
            <span
              className={css({
                fontSize: 'xs',
                paddingX: '2',
                paddingY: '0.5',
                borderRadius: 'full',
                backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
                color: { base: 'blue.700', _dark: 'blue.300' },
              })}
            >
              {difficulty}
            </span>
          )}
          {status && (
            <span
              className={css({
                fontSize: 'xs',
                paddingX: '2',
                paddingY: '0.5',
                borderRadius: 'full',
                backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                color: { base: 'gray.600', _dark: 'gray.400' },
              })}
            >
              {status}
            </span>
          )}
          {diagnosticReport && <DiagnosticBadge report={diagnosticReport} />}
        </div>
        {subtitle && (
          <p
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.500', _dark: 'gray.500' },
              marginTop: '1',
            })}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )

  // If there are actions, render as a div with action buttons
  if (hasActions) {
    return (
      <div
        data-component="flowchart-card"
        className={css({
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '3',
          padding: '4',
          backgroundColor: { base: 'white', _dark: 'gray.800' },
          borderRadius: 'xl',
          boxShadow: 'md',
          border: '2px solid',
          borderColor: { base: 'gray.200', _dark: 'gray.700' },
          overflow: 'hidden',
        })}
      >
        {/* Animated background tiles */}
        {hasExamples && <AnimatedBackgroundTiles examples={examples} flowchart={flowchart} />}

        {/* Card content (above background) */}
        <div className={css({ position: 'relative', zIndex: 1, overflow: 'hidden' })}>
          {onClick ? (
            <button
              onClick={onClick}
              className={css({
                display: 'flex',
                width: '100%',
                minWidth: 0,
                background: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                textAlign: 'left',
                _hover: {
                  '& h2': {
                    color: { base: 'blue.600', _dark: 'blue.400' },
                  },
                },
              })}
            >
              {cardContent}
            </button>
          ) : (
            cardContent
          )}
          <div className={hstack({ gap: '2', justifyContent: 'flex-end', marginTop: '3' })}>
            {actions.map((action, i) => {
              const buttonStyles = css({
                paddingY: '2',
                paddingX: '4',
                borderRadius: 'md',
                fontSize: 'sm',
                fontWeight: 'medium',
                border: 'none',
                cursor: action.disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: action.disabled ? 0.5 : 1,
                textDecoration: 'none',
                display: 'inline-block',
                ...(action.variant === 'primary'
                  ? {
                      backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
                      color: { base: 'blue.700', _dark: 'blue.300' },
                      _hover: action.disabled
                        ? {}
                        : {
                            backgroundColor: { base: 'blue.200', _dark: 'blue.800' },
                          },
                    }
                  : action.variant === 'danger'
                    ? {
                        backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                        color: { base: 'gray.600', _dark: 'gray.400' },
                        _hover: action.disabled
                          ? {}
                          : {
                              backgroundColor: { base: 'red.100', _dark: 'red.900' },
                              color: { base: 'red.600', _dark: 'red.400' },
                            },
                      }
                    : {
                        backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                        color: { base: 'gray.700', _dark: 'gray.300' },
                        _hover: action.disabled
                          ? {}
                          : {
                              backgroundColor: { base: 'gray.200', _dark: 'gray.600' },
                            },
                      }),
              })

              // Render as Link when href is provided
              if (action.href && !action.disabled) {
                return (
                  <Link
                    key={i}
                    href={action.href}
                    className={buttonStyles}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {action.label}
                  </Link>
                )
              }

              // Render as button for onClick handlers or disabled states
              return (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!action.disabled && action.onClick) {
                      action.onClick()
                    }
                  }}
                  disabled={action.disabled}
                  className={buttonStyles}
                >
                  {action.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Simple clickable card without actions
  return (
    <div
      data-component="flowchart-card"
      className={css({
        position: 'relative',
        borderRadius: 'xl',
        overflow: 'hidden',
      })}
    >
      {/* Animated background tiles */}
      {hasExamples && <AnimatedBackgroundTiles examples={examples} flowchart={flowchart} />}

      <button
        onClick={onClick}
        className={css({
          position: 'relative',
          zIndex: 1,
          display: 'block',
          width: '100%',
          minWidth: 0,
          padding: '6',
          backgroundColor: { base: 'white', _dark: 'gray.800' },
          borderRadius: 'xl',
          boxShadow: 'md',
          border: '2px solid',
          borderColor: { base: 'gray.200', _dark: 'gray.700' },
          transition: 'all 0.2s',
          textDecoration: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          _hover: {
            borderColor: { base: 'blue.400', _dark: 'blue.500' },
            transform: 'translateY(-2px)',
            boxShadow: 'lg',
          },
        })}
      >
        {cardContent}
      </button>
    </div>
  )
}

/**
 * Big "+" button for creating new flowcharts.
 */
export function CreateFlowchartButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2',
        width: '100%',
        minHeight: '140px',
        padding: '6',
        backgroundColor: { base: 'blue.50', _dark: 'blue.950' },
        borderRadius: 'xl',
        border: '3px dashed',
        borderColor: { base: 'blue.300', _dark: 'blue.700' },
        transition: 'all 0.2s',
        cursor: 'pointer',
        _hover: {
          backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
          borderColor: { base: 'blue.400', _dark: 'blue.600' },
          transform: 'translateY(-2px)',
        },
      })}
    >
      <span
        className={css({
          fontSize: '4xl',
          fontWeight: 'bold',
          color: { base: 'blue.500', _dark: 'blue.400' },
          lineHeight: 1,
        })}
      >
        +
      </span>
      <span
        className={css({
          fontSize: 'md',
          fontWeight: 'semibold',
          color: { base: 'blue.600', _dark: 'blue.400' },
        })}
      >
        Create Your Own
      </span>
      <span
        className={css({
          fontSize: 'sm',
          color: { base: 'blue.500', _dark: 'blue.500' },
        })}
      >
        Design a custom flowchart with AI
      </span>
    </button>
  )
}
