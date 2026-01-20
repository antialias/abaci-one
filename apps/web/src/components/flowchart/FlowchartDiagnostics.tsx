'use client'

import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'
import type { DiagnosticReport, FlowchartDiagnostic } from '@/lib/flowcharts/doctor'

// =============================================================================
// Badge Component (for FlowchartCard)
// =============================================================================

export interface DiagnosticBadgeProps {
  report: DiagnosticReport
  /** Show only if there are errors (not warnings) */
  errorsOnly?: boolean
}

/**
 * Small badge indicating flowchart health status.
 * Shows error count if unhealthy, warning count if there are warnings.
 */
export function DiagnosticBadge({ report, errorsOnly = false }: DiagnosticBadgeProps) {
  if (report.isHealthy && (errorsOnly || report.warningCount === 0)) {
    return null
  }

  const hasErrors = report.errorCount > 0
  const count = hasErrors ? report.errorCount : report.warningCount
  const label = hasErrors
    ? count === 1
      ? 'issue'
      : 'issues'
    : count === 1
      ? 'warning'
      : 'warnings'

  return (
    <div
      data-element="diagnostic-badge"
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '1',
        px: '2',
        py: '0.5',
        borderRadius: 'full',
        fontSize: 'xs',
        fontWeight: 'medium',
        backgroundColor: hasErrors ? 'red.100' : 'yellow.100',
        color: hasErrors ? 'red.700' : 'yellow.700',
        _dark: {
          backgroundColor: hasErrors ? 'red.900/30' : 'yellow.900/30',
          color: hasErrors ? 'red.300' : 'yellow.300',
        },
      })}
      title={`${count} ${label} found`}
    >
      <span>{hasErrors ? '⚠️' : '⚡'}</span>
      <span>{count}</span>
    </div>
  )
}

// =============================================================================
// Alert Banner Component (for workshop)
// =============================================================================

export interface DiagnosticAlertProps {
  report: DiagnosticReport
  /** Callback when user wants to see details */
  onShowDetails?: () => void
  /** Whether to show in compact mode */
  compact?: boolean
}

/**
 * Alert banner showing diagnostic summary.
 * Used at the top of pages/sections to indicate issues.
 */
export function DiagnosticAlert({ report, onShowDetails, compact = false }: DiagnosticAlertProps) {
  if (report.isHealthy && report.warningCount === 0) {
    return null
  }

  const hasErrors = report.errorCount > 0

  return (
    <div
      data-element="diagnostic-alert"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '3',
        p: compact ? '2' : '3',
        borderRadius: 'md',
        borderWidth: '1px',
        borderColor: hasErrors ? 'red.200' : 'yellow.200',
        backgroundColor: hasErrors ? 'red.50' : 'yellow.50',
        color: hasErrors ? 'red.800' : 'yellow.800',
        _dark: {
          borderColor: hasErrors ? 'red.800' : 'yellow.800',
          backgroundColor: hasErrors ? 'red.950/50' : 'yellow.950/50',
          color: hasErrors ? 'red.200' : 'yellow.200',
        },
      })}
    >
      <div className={hstack({ gap: '2' })}>
        <span className={css({ fontSize: compact ? 'md' : 'lg' })}>{hasErrors ? '⚠️' : '⚡'}</span>
        <div>
          <span className={css({ fontWeight: 'medium' })}>
            {hasErrors
              ? `${report.errorCount} ${report.errorCount === 1 ? 'error' : 'errors'} found`
              : `${report.warningCount} ${report.warningCount === 1 ? 'warning' : 'warnings'}`}
          </span>
          {!compact && hasErrors && (
            <span
              className={css({
                color: hasErrors ? 'red.600' : 'yellow.600',
                _dark: { color: hasErrors ? 'red.300' : 'yellow.300' },
              })}
            >
              {' '}
              — Example generation may fail
            </span>
          )}
        </div>
      </div>
      {onShowDetails && (
        <button
          onClick={onShowDetails}
          className={css({
            px: '2',
            py: '1',
            fontSize: 'sm',
            fontWeight: 'medium',
            borderRadius: 'md',
            backgroundColor: hasErrors ? 'red.200' : 'yellow.200',
            color: hasErrors ? 'red.800' : 'yellow.800',
            cursor: 'pointer',
            _hover: {
              backgroundColor: hasErrors ? 'red.300' : 'yellow.300',
            },
            _dark: {
              backgroundColor: hasErrors ? 'red.800' : 'yellow.800',
              color: hasErrors ? 'red.100' : 'yellow.100',
              _hover: {
                backgroundColor: hasErrors ? 'red.700' : 'yellow.700',
              },
            },
          })}
        >
          View Details
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Full Diagnostic List Component (for modal/details)
// =============================================================================

export interface DiagnosticListProps {
  report: DiagnosticReport
  /** Maximum number of items to show before "show more" */
  maxItems?: number
  /** Called when a diagnostic item is clicked */
  onDiagnosticClick?: (diagnostic: FlowchartDiagnostic) => void
}

/**
 * Detailed list of all diagnostics with full provenance information.
 */
export function DiagnosticList({ report, maxItems, onDiagnosticClick }: DiagnosticListProps) {
  if (report.diagnostics.length === 0) {
    return (
      <div
        data-element="diagnostic-list-empty"
        className={css({
          p: '4',
          textAlign: 'center',
          color: 'green.600',
          _dark: { color: 'green.400' },
        })}
      >
        ✅ No issues found
      </div>
    )
  }

  const items = maxItems ? report.diagnostics.slice(0, maxItems) : report.diagnostics
  const hasMore = maxItems && report.diagnostics.length > maxItems

  return (
    <div data-element="diagnostic-list" className={vstack({ gap: '3', alignItems: 'stretch' })}>
      {items.map((diagnostic, index) => (
        <DiagnosticItem
          key={`${diagnostic.code}-${index}`}
          diagnostic={diagnostic}
          onClick={onDiagnosticClick ? () => onDiagnosticClick(diagnostic) : undefined}
        />
      ))}
      {hasMore && (
        <div className={css({ textAlign: 'center', color: 'gray.500', fontSize: 'sm' })}>
          +{report.diagnostics.length - maxItems} more issues
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Single Diagnostic Item
// =============================================================================

interface DiagnosticItemProps {
  diagnostic: FlowchartDiagnostic
  /** Called when the item is clicked */
  onClick?: () => void
}

function DiagnosticItem({ diagnostic, onClick }: DiagnosticItemProps) {
  const isError = diagnostic.severity === 'error'
  const isWarning = diagnostic.severity === 'warning'
  const isClickable = !!onClick

  return (
    <div
      data-element="diagnostic-item"
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      className={css({
        p: '3',
        borderRadius: 'md',
        borderWidth: '1px',
        borderLeftWidth: '4px',
        borderColor: isError ? 'red.200' : isWarning ? 'yellow.200' : 'blue.200',
        borderLeftColor: isError ? 'red.500' : isWarning ? 'yellow.500' : 'blue.500',
        backgroundColor: { base: 'white', _dark: 'gray.900' },
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.15s',
        _dark: {
          borderColor: isError ? 'red.800' : isWarning ? 'yellow.800' : 'blue.800',
          borderLeftColor: isError ? 'red.500' : isWarning ? 'yellow.500' : 'blue.500',
        },
        ...(isClickable && {
          _hover: {
            transform: 'translateX(2px)',
            boxShadow: 'sm',
          },
        }),
      })}
    >
      {/* Header */}
      <div className={hstack({ gap: '2', mb: '1' })}>
        <span className={css({ fontSize: 'sm' })}>{isError ? '❌' : isWarning ? '⚠️' : 'ℹ️'}</span>
        <span
          className={css({
            fontWeight: 'semibold',
            color: isError ? 'red.700' : isWarning ? 'yellow.700' : 'blue.700',
            _dark: {
              color: isError ? 'red.300' : isWarning ? 'yellow.300' : 'blue.300',
            },
          })}
        >
          {diagnostic.title}
        </span>
        <span
          className={css({
            fontSize: 'xs',
            color: 'gray.500',
            fontFamily: 'mono',
          })}
        >
          [{diagnostic.code}]
        </span>
      </div>

      {/* Location */}
      <div
        className={css({
          fontSize: 'xs',
          fontFamily: 'mono',
          color: 'gray.600',
          mb: '2',
          p: '1',
          backgroundColor: 'gray.100',
          borderRadius: 'sm',
          _dark: {
            backgroundColor: 'gray.800',
            color: 'gray.400',
          },
        })}
      >
        📍 {diagnostic.location.description}
      </div>

      {/* Message */}
      <p
        className={css({
          fontSize: 'sm',
          color: 'gray.700',
          _dark: { color: 'gray.300' },
          mb: '2',
        })}
      >
        {diagnostic.message}
      </p>

      {/* Suggestion */}
      {diagnostic.suggestion && (
        <div
          className={css({
            fontSize: 'sm',
            color: 'green.700',
            p: '2',
            backgroundColor: 'green.50',
            borderRadius: 'sm',
            _dark: { color: 'green.400', backgroundColor: 'green.950/30' },
          })}
        >
          💡 <strong>Suggestion:</strong> {diagnostic.suggestion}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Exports
// =============================================================================

export type { DiagnosticReport, FlowchartDiagnostic }
