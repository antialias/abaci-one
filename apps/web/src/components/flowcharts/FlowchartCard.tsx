'use client'

import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'
import type { TeacherFlowchart } from '@/hooks/useTeacherFlowcharts'

interface Props {
  flowchart: TeacherFlowchart
  isLoading: boolean
  onEdit: () => void
  onPublish: () => void
  onUnpublish: () => void
  onDelete: () => void
  onUse: () => void
}

export function FlowchartCard({
  flowchart,
  isLoading,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
  onUse,
}: Props) {
  return (
    <div
      data-element="flowchart-card"
      className={css({
        padding: '4',
        backgroundColor: { base: 'white', _dark: 'gray.800' },
        borderRadius: 'lg',
        border: '1px solid',
        borderColor: { base: 'gray.200', _dark: 'gray.700' },
      })}
    >
      <div
        className={hstack({ gap: '4', justifyContent: 'space-between', alignItems: 'flex-start' })}
      >
        <div className={hstack({ gap: '3', alignItems: 'flex-start' })}>
          <span className={css({ fontSize: '2xl' })}>{flowchart.emoji || '📊'}</span>
          <div className={vstack({ gap: '1', alignItems: 'flex-start' })}>
            <h3
              className={css({
                fontWeight: 'semibold',
                color: { base: 'gray.900', _dark: 'gray.100' },
              })}
            >
              {flowchart.title}
            </h3>
            {flowchart.description && (
              <p
                className={css({
                  fontSize: 'sm',
                  color: { base: 'gray.600', _dark: 'gray.400' },
                })}
              >
                {flowchart.description}
              </p>
            )}
            <div className={hstack({ gap: '2' })}>
              {flowchart.difficulty && (
                <span
                  className={css({
                    fontSize: 'xs',
                    padding: '0.5 2',
                    borderRadius: 'full',
                    backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
                    color: { base: 'blue.700', _dark: 'blue.300' },
                  })}
                >
                  {flowchart.difficulty}
                </span>
              )}
              <span
                className={css({
                  fontSize: 'xs',
                  padding: '0.5 2',
                  borderRadius: 'full',
                  backgroundColor:
                    flowchart.status === 'published'
                      ? { base: 'green.100', _dark: 'green.900' }
                      : { base: 'gray.100', _dark: 'gray.700' },
                  color:
                    flowchart.status === 'published'
                      ? { base: 'green.700', _dark: 'green.300' }
                      : { base: 'gray.600', _dark: 'gray.400' },
                })}
              >
                {flowchart.status}
              </span>
              {flowchart.version > 1 && (
                <span
                  className={css({
                    fontSize: 'xs',
                    color: { base: 'gray.500', _dark: 'gray.500' },
                  })}
                >
                  v{flowchart.version}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={hstack({ gap: '2' })}>
          {flowchart.status === 'published' && (
            <button
              data-action="use"
              onClick={onUse}
              disabled={isLoading}
              className={css({
                paddingY: '2',
                paddingX: '3',
                borderRadius: 'md',
                backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
                color: 'white',
                fontSize: 'sm',
                fontWeight: 'medium',
                border: 'none',
                cursor: 'pointer',
                _hover: { backgroundColor: { base: 'blue.700', _dark: 'blue.600' } },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Use
            </button>
          )}
          <button
            data-action="edit"
            onClick={onEdit}
            disabled={isLoading}
            className={css({
              paddingY: '2',
              paddingX: '3',
              borderRadius: 'md',
              backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
              color: { base: 'gray.700', _dark: 'gray.300' },
              fontSize: 'sm',
              border: 'none',
              cursor: 'pointer',
              _hover: { backgroundColor: { base: 'gray.200', _dark: 'gray.600' } },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            Edit
          </button>
          {flowchart.status === 'draft' ? (
            <button
              data-action="publish"
              onClick={onPublish}
              disabled={isLoading}
              className={css({
                paddingY: '2',
                paddingX: '3',
                borderRadius: 'md',
                backgroundColor: { base: 'green.100', _dark: 'green.900' },
                color: { base: 'green.700', _dark: 'green.300' },
                fontSize: 'sm',
                fontWeight: 'medium',
                border: 'none',
                cursor: 'pointer',
                _hover: { backgroundColor: { base: 'green.200', _dark: 'green.800' } },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isLoading ? '…' : 'Publish'}
            </button>
          ) : (
            <button
              data-action="unpublish"
              onClick={onUnpublish}
              disabled={isLoading}
              className={css({
                paddingY: '2',
                paddingX: '3',
                borderRadius: 'md',
                backgroundColor: { base: 'yellow.100', _dark: 'yellow.900' },
                color: { base: 'yellow.700', _dark: 'yellow.300' },
                fontSize: 'sm',
                border: 'none',
                cursor: 'pointer',
                _hover: { backgroundColor: { base: 'yellow.200', _dark: 'yellow.800' } },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isLoading ? '…' : 'Unpublish'}
            </button>
          )}
          <button
            data-action="delete"
            onClick={onDelete}
            disabled={isLoading}
            className={css({
              paddingY: '2',
              paddingX: '3',
              borderRadius: 'md',
              backgroundColor: 'transparent',
              color: { base: 'gray.500', _dark: 'gray.500' },
              fontSize: 'sm',
              border: 'none',
              cursor: 'pointer',
              _hover: {
                backgroundColor: { base: 'red.50', _dark: 'red.900/30' },
                color: { base: 'red.600', _dark: 'red.400' },
              },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  )
}
