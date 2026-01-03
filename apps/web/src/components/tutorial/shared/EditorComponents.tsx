'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'
import { css } from '../../../../styled-system/css'
import { hstack, vstack } from '../../../../styled-system/patterns'

// Shared input styles
export const inputStyles = {
  w: 'full',
  px: 2,
  py: 1,
  border: '1px solid',
  borderColor: 'gray.300',
  rounded: 'sm',
  fontSize: 'xs',
} as const

export const labelStyles = {
  fontSize: 'xs',
  color: 'gray.600',
  mb: 1,
  display: 'block',
} as const

// Shared Editor Layout Component - wraps entire editor with consistent styling
interface EditorLayoutProps {
  title: string
  onClose: () => void
  onDelete?: () => void
  deleteLabel?: string
  children: ReactNode
  className?: string
}

export function EditorLayout({
  title,
  onClose,
  onDelete,
  deleteLabel = 'Delete',
  children,
  className,
}: EditorLayoutProps) {
  return (
    <div
      className={css(
        {
          p: 3,
          bg: 'purple.50',
          border: '1px solid',
          borderColor: 'purple.200',
          rounded: 'lg',
          height: '100%',
          overflowY: 'auto',
        },
        className
      )}
    >
      <div className={vstack({ gap: 3, alignItems: 'stretch' })}>
        {/* Header */}
        <EditorHeader
          title={title}
          onClose={onClose}
          onDelete={onDelete}
          deleteLabel={deleteLabel}
        />

        {/* Content */}
        {children}
      </div>
    </div>
  )
}

// Shared Editor Header Component
interface EditorHeaderProps {
  title: string
  onClose: () => void
  onDelete?: () => void
  deleteLabel?: string
}

export function EditorHeader({
  title,
  onClose,
  onDelete,
  deleteLabel = 'Delete',
}: EditorHeaderProps) {
  return (
    <div
      className={hstack({
        justifyContent: 'space-between',
        alignItems: 'center',
      })}
    >
      <h3
        className={css({
          fontSize: 'md',
          fontWeight: 'semibold',
          color: 'purple.800',
        })}
      >
        {title}
      </h3>
      <div className={hstack({ gap: 1 })}>
        {onDelete && (
          <button
            onClick={onDelete}
            className={css({
              px: 2,
              py: 1,
              bg: 'red.500',
              color: 'white',
              rounded: 'sm',
              fontSize: 'xs',
              cursor: 'pointer',
              _hover: { bg: 'red.600' },
            })}
          >
            {deleteLabel}
          </button>
        )}
        <button
          onClick={onClose}
          className={css({
            p: 1,
            borderRadius: 'sm',
            cursor: 'pointer',
            _hover: { bg: 'gray.100' },
          })}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// Shared Field Component
interface FieldProps {
  label: string
  children: ReactNode
}

export function Field({ label, children }: FieldProps) {
  return (
    <div>
      <label className={css(labelStyles)}>{label}</label>
      {children}
    </div>
  )
}

// Shared Text Input Component
interface TextInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 2,
}: TextInputProps) {
  return (
    <Field label={label}>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={css({
            ...inputStyles,
            resize: 'none',
          })}
          placeholder={placeholder}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={css(inputStyles)}
          placeholder={placeholder}
        />
      )}
    </Field>
  )
}

// Shared Number Input Component
interface NumberInputProps {
  label: string
  value: number | string
  onChange: (value: number) => void
  min?: number
  max?: number
  placeholder?: string
}

export function NumberInput({ label, value, onChange, min, max, placeholder }: NumberInputProps) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className={css(inputStyles)}
        placeholder={placeholder}
      />
    </Field>
  )
}

// Shared Grid Layout Component
interface GridLayoutProps {
  columns: 1 | 2 | 3 | 4
  gap?: number
  children: ReactNode
}

export function GridLayout({ columns, gap = 2, children }: GridLayoutProps) {
  const gridCols = {
    1: '1fr',
    2: '1fr 1fr',
    3: '1fr 1fr 1fr',
    4: '1fr 1fr 1fr 1fr',
  }

  return (
    <div
      className={css({
        display: 'grid',
        gridTemplateColumns: gridCols[columns],
        gap: gap,
      })}
    >
      {children}
    </div>
  )
}

// Shared Section Component
interface SectionProps {
  title?: string
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  background?: 'white' | 'gray' | 'none'
}

export function Section({ title, children, background = 'white' }: SectionProps) {
  const bgStyles = {
    white: {
      p: 2,
      bg: 'white',
      border: '1px solid',
      borderColor: 'gray.200',
      rounded: 'md',
    },
    gray: {
      p: 2,
      bg: 'gray.50',
      border: '1px solid',
      borderColor: 'gray.200',
      rounded: 'sm',
    },
    none: {},
  }

  return (
    <div className={css(bgStyles[background])}>
      {title && (
        <h4
          className={css({
            fontSize: 'sm',
            fontWeight: 'medium',
            mb: 2,
            color: 'gray.800',
          })}
        >
          {title}
        </h4>
      )}
      {children}
    </div>
  )
}

// Shared Form Group Component - handles common form layouts
interface FormGroupProps {
  children: ReactNode
  columns?: 1 | 2 | 3
  gap?: number
}

export function FormGroup({ children, columns = 1, gap = 2 }: FormGroupProps) {
  if (columns === 1) {
    return <div className={vstack({ gap: gap, alignItems: 'stretch' })}>{children}</div>
  }

  return (
    <GridLayout columns={columns} gap={gap}>
      {children}
    </GridLayout>
  )
}

// Shared Compact Step Item Component
interface CompactStepItemProps {
  type: 'concept' | 'practice'
  index: number
  title: string
  subtitle?: string
  description?: string
  isSelected?: boolean
  hasErrors?: boolean
  hasWarnings?: boolean
  errorCount?: number
  warningCount?: number
  onClick?: () => void
  onPreview?: () => void
  onDelete?: () => void
  children?: ReactNode
  // Hover-add functionality
  onAddStepBefore?: () => void
  onAddPracticeStepBefore?: () => void
  onAddStepAfter?: () => void
  onAddPracticeStepAfter?: () => void
}

export function CompactStepItem({
  type,
  index,
  title,
  subtitle,
  description,
  isSelected = false,
  hasErrors = false,
  hasWarnings = false,
  errorCount = 0,
  warningCount = 0,
  onClick,
  onPreview,
  onDelete,
  children,
  onAddStepBefore,
  onAddPracticeStepBefore,
  onAddStepAfter,
  onAddPracticeStepAfter,
}: CompactStepItemProps) {
  const getBorderColor = () => {
    if (isSelected) return 'blue.500'
    if (hasErrors) return 'red.300'
    return 'gray.200'
  }

  const getBgColor = () => {
    if (isSelected) return 'blue.50'
    if (hasWarnings) return 'yellow.50'
    if (hasErrors) return 'red.50'
    return 'white'
  }

  const getHoverBg = () => {
    return isSelected ? 'blue.100' : 'gray.50'
  }

  const typeIcon = type === 'concept' ? '📝' : '🎯'
  const typeLabel = type === 'concept' ? 'Step' : 'Practice'

  const _hasAddActions =
    onAddStepBefore || onAddPracticeStepBefore || onAddStepAfter || onAddPracticeStepAfter

  return (
    <div className={css({ position: 'relative' })}>
      {/* Main step item */}
      <div
        onClick={onClick}
        className={css({
          px: 1.5,
          py: 1,
          border: '1px solid',
          borderColor: getBorderColor(),
          borderRadius: 'sm',
          bg: getBgColor(),
          cursor: onClick ? 'pointer' : 'default',
          _hover: onClick ? { bg: getHoverBg() } : {},
        })}
      >
        <div
          className={hstack({
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          })}
        >
          <div className={css({ flex: 1, minWidth: 0 })}>
            {/* Inline header: badges, title, and subtitle on same line when possible */}
            <div
              className={hstack({
                gap: 1.5,
                alignItems: 'center',
                flexWrap: 'wrap',
              })}
            >
              <span
                className={css({
                  fontSize: 'xs',
                  fontWeight: 'bold',
                  color: type === 'concept' ? 'blue.800' : 'purple.800',
                  bg: type === 'concept' ? 'blue.100' : 'purple.100',
                  px: 0.5,
                  py: 0.5,
                  borderRadius: 'xs',
                  flexShrink: 0,
                })}
              >
                {typeIcon} {typeLabel} {index + 1}
              </span>

              {/* Title inline */}
              <div
                className={css({
                  fontWeight: 'medium',
                  fontSize: 'xs',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0,
                })}
              >
                {title}
              </div>

              {/* Error/warning badges - compact */}
              {hasErrors && (
                <span
                  className={css({
                    fontSize: 'xs',
                    color: 'red.600',
                    bg: 'red.100',
                    px: 1,
                    py: 0.5,
                    borderRadius: 'xs',
                    flexShrink: 0,
                  })}
                >
                  {errorCount}❌
                </span>
              )}

              {hasWarnings && (
                <span
                  className={css({
                    fontSize: 'xs',
                    color: 'yellow.600',
                    bg: 'yellow.100',
                    px: 1,
                    py: 0.5,
                    borderRadius: 'xs',
                    flexShrink: 0,
                  })}
                >
                  {warningCount}⚠️
                </span>
              )}
            </div>

            {/* Subtitle on separate line if provided */}
            {subtitle && (
              <div
                className={css({
                  fontSize: 'xs',
                  color: 'gray.600',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  mt: 0.5,
                })}
              >
                {subtitle}
              </div>
            )}

            {/* Custom children content */}
            {children}
          </div>

          {/* Action buttons */}
          <div className={hstack({ gap: 1, flexShrink: 0 })}>
            {onPreview && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPreview()
                }}
                className={css({
                  p: 1,
                  bg: 'blue.100',
                  color: 'blue.700',
                  border: '1px solid',
                  borderColor: 'blue.300',
                  borderRadius: 'sm',
                  fontSize: 'xs',
                  cursor: 'pointer',
                  _hover: { bg: 'blue.200' },
                })}
                title="Preview"
              >
                👁
              </button>
            )}

            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className={css({
                  p: 1,
                  bg: 'red.100',
                  color: 'red.700',
                  border: '1px solid',
                  borderColor: 'red.300',
                  borderRadius: 'sm',
                  fontSize: 'xs',
                  cursor: 'pointer',
                  _hover: { bg: 'red.200' },
                })}
                title="Delete"
              >
                🗑
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Between-step hover area with dropdown
interface BetweenStepAddProps {
  onAddStep: () => void
  onAddPracticeStep: () => void
}

export function BetweenStepAdd({ onAddStep, onAddPracticeStep }: BetweenStepAddProps) {
  return (
    <div
      className={css({
        position: 'relative',
        height: '16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50, // Higher z-index for the container
        '&:hover .add-button': {
          opacity: 0.5,
        },
      })}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className={`${css({
              px: 2,
              py: 0.5,
              bg: 'gray.100',
              color: 'gray.600',
              border: '1px dashed',
              borderColor: 'gray.300',
              borderRadius: 'sm',
              fontSize: 'xs',
              cursor: 'pointer',
              opacity: 0,
              transition: 'opacity 0.2s ease',
              zIndex: 50, // Higher z-index for the button
              position: 'relative',
              _hover: {
                opacity: '1 !important',
                bg: 'gray.200',
                borderColor: 'gray.400',
              },
            })} add-button`}
          >
            + New
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={css({
              mt: 1,
              bg: 'white',
              border: '1px solid',
              borderColor: 'gray.200',
              borderRadius: 'md',
              shadow: 'md',
              zIndex: 100, // Very high z-index for dropdown content
              minW: '150px',
            })}
            sideOffset={4}
          >
            <DropdownMenu.Item asChild>
              <button
                onClick={onAddStep}
                className={css({
                  w: 'full',
                  px: 3,
                  py: 2,
                  textAlign: 'left',
                  fontSize: 'sm',
                  cursor: 'pointer',
                  border: 'none',
                  bg: 'transparent',
                  _hover: { bg: 'blue.50', color: 'blue.700' },
                  borderBottom: '1px solid',
                  borderColor: 'gray.100',
                })}
              >
                📝 Concept Step
              </button>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild>
              <button
                onClick={onAddPracticeStep}
                className={css({
                  w: 'full',
                  px: 3,
                  py: 2,
                  textAlign: 'left',
                  fontSize: 'sm',
                  cursor: 'pointer',
                  border: 'none',
                  bg: 'transparent',
                  _hover: { bg: 'purple.50', color: 'purple.700' },
                })}
              >
                🎯 Problem Page
              </button>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}

// Shared Button Component
interface ButtonProps {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'xs' | 'sm' | 'md'
  disabled?: boolean
  title?: string
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'sm',
  disabled = false,
  title,
}: ButtonProps) {
  const variantStyles = {
    primary: { bg: 'blue.500', color: 'white', _hover: { bg: 'blue.600' } },
    secondary: {
      bg: 'blue.100',
      color: 'blue.800',
      border: '1px solid',
      borderColor: 'blue.300',
      _hover: { bg: 'blue.200' },
    },
    outline: {
      bg: 'gray.100',
      color: 'gray.700',
      border: '1px solid',
      borderColor: 'gray.300',
      _hover: { bg: 'gray.200' },
    },
  }

  const sizeStyles = {
    xs: { px: 1, py: 1, fontSize: 'xs' },
    sm: { px: 2, py: 1, fontSize: 'xs' },
    md: { px: 3, py: 2, fontSize: 'sm' },
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={css({
        ...variantStyles[variant],
        ...sizeStyles[size],
        rounded: 'sm',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'center',
      })}
    >
      {children}
    </button>
  )
}
