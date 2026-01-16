'use client'

import type { ParsedNodeContent } from '@/lib/flowcharts/schema'
import { css } from '../../../styled-system/css'
import { vstack } from '../../../styled-system/patterns'

interface FlowchartNodeContentProps {
  content: ParsedNodeContent
  /** Whether to show in compact mode */
  compact?: boolean
}

/**
 * Renders parsed node content with proper formatting.
 * Handles title, body, examples, warnings, and checklists.
 */
export function FlowchartNodeContent({ content, compact = false }: FlowchartNodeContentProps) {
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
        <ul
          data-testid="node-content-checklist"
          data-item-count={content.checklist.length}
          className={css({
            listStyle: 'none',
            padding: '3',
            backgroundColor: { base: 'green.50', _dark: 'green.900' },
            borderRadius: 'md',
          })}
        >
          {content.checklist.map((item, i) => (
            <li
              key={i}
              data-testid={`checklist-item-${i}`}
              className={css({
                fontSize: 'sm',
                color: { base: 'green.800', _dark: 'green.200' },
                marginBottom: '1',
              })}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
