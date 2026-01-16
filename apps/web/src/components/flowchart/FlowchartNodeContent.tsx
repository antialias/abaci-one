'use client'

import type { ParsedNodeContent } from '@/lib/flowcharts/schema'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

interface FlowchartNodeContentProps {
  content: ParsedNodeContent
  /** Whether to show in compact mode */
  compact?: boolean
  /** For interactive checklists: which items are checked (by index) */
  checkedItems?: Set<number>
  /** Callback when a checklist item is toggled */
  onChecklistToggle?: (index: number) => void
}

/**
 * Renders parsed node content with proper formatting.
 * Handles title, body, examples, warnings, and checklists.
 */
export function FlowchartNodeContent({
  content,
  compact = false,
  checkedItems,
  onChecklistToggle,
}: FlowchartNodeContentProps) {
  const isInteractiveChecklist = checkedItems !== undefined && onChecklistToggle !== undefined
  return (
    <div
      data-testid="node-content"
      data-has-warning={!!content.warning}
      data-has-example={!!content.example}
      data-has-checklist={!!content.checklist?.length}
      className={vstack({ gap: compact ? '2' : '3', alignItems: 'stretch' })}
    >
      {/* Title */}
      <h3
        data-testid="node-content-title"
        className={css({
          fontSize: compact ? 'lg' : 'xl',
          fontWeight: 'bold',
          color: { base: 'gray.900', _dark: 'gray.100' },
        })}
      >
        {content.title}
      </h3>

      {/* Body */}
      {content.body.length > 0 && (
        <div
          data-testid="node-content-body"
          data-line-count={content.body.length}
          className={css({
            fontSize: compact ? 'sm' : 'md',
            color: { base: 'gray.700', _dark: 'gray.300' },
            lineHeight: '1.5',
          })}
        >
          {content.body.map((line, i) => (
            <p key={i} className={css({ marginBottom: '1' })}>
              {line}
            </p>
          ))}
        </div>
      )}

      {/* Warning */}
      {content.warning && (
        <div
          data-testid="node-content-warning"
          className={css({
            padding: '3',
            backgroundColor: { base: 'orange.100', _dark: 'orange.900' },
            borderRadius: 'md',
            borderLeft: '4px solid',
            borderColor: { base: 'orange.500', _dark: 'orange.400' },
            fontSize: 'sm',
            color: { base: 'orange.800', _dark: 'orange.200' },
          })}
        >
          {content.warning}
        </div>
      )}

      {/* Example */}
      {content.example && (
        <div
          data-testid="node-content-example"
          className={css({
            padding: '3',
            backgroundColor: { base: 'blue.50', _dark: 'blue.900' },
            borderRadius: 'md',
            fontSize: 'sm',
            fontStyle: 'italic',
            color: { base: 'blue.700', _dark: 'blue.300' },
            whiteSpace: 'pre-line',
          })}
        >
          {content.example}
        </div>
      )}

      {/* Checklist */}
      {content.checklist && content.checklist.length > 0 && (
        <div
          data-testid="node-content-checklist"
          data-item-count={content.checklist.length}
          data-interactive={isInteractiveChecklist}
          className={css({
            padding: '3',
            backgroundColor: { base: 'green.50', _dark: 'green.900' },
            borderRadius: 'md',
          })}
        >
          {content.checklist.map((item, i) => {
            // Strip the ☐ or ☑ prefix from the item text (we'll use real checkboxes)
            const itemText = item.replace(/^[☐☑]\s*/, '')
            const isChecked = checkedItems?.has(i) ?? false

            return isInteractiveChecklist ? (
              <label
                key={i}
                data-testid={`checklist-item-${i}`}
                data-checked={isChecked}
                className={hstack({
                  gap: '3',
                  cursor: 'pointer',
                  padding: '2',
                  marginBottom: '1',
                  borderRadius: 'md',
                  transition: 'all 0.15s ease-out',
                  backgroundColor: isChecked
                    ? { base: 'green.200', _dark: 'green.800' }
                    : 'transparent',
                  _hover: {
                    backgroundColor: isChecked
                      ? { base: 'green.200', _dark: 'green.800' }
                      : { base: 'green.100', _dark: 'green.800/50' },
                  },
                })}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onChecklistToggle?.(i)}
                  className={css({
                    width: '20px',
                    height: '20px',
                    accentColor: 'green',
                    cursor: 'pointer',
                  })}
                />
                <span
                  className={css({
                    fontSize: 'sm',
                    color: { base: 'green.800', _dark: 'green.200' },
                    textDecoration: isChecked ? 'line-through' : 'none',
                    opacity: isChecked ? 0.8 : 1,
                  })}
                >
                  {itemText}
                </span>
              </label>
            ) : (
              <div
                key={i}
                data-testid={`checklist-item-${i}`}
                className={css({
                  fontSize: 'sm',
                  color: { base: 'green.800', _dark: 'green.200' },
                  marginBottom: '1',
                  paddingLeft: '2',
                })}
              >
                {item}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
