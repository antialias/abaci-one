'use client'

import * as Select from '@radix-ui/react-select'
import { ChevronDown } from 'lucide-react'
import { css } from '../../styled-system/css'
import { hstack, stack } from '../../styled-system/patterns'

interface FormatOption {
  value: string
  label: string
  icon: string
  description: string
}

interface FormatSelectFieldProps {
  value: string
  onValueChange: (value: string) => void
}

const formatOptions: FormatOption[] = [
  {
    value: 'pdf',
    label: 'PDF',
    icon: '📄',
    description: 'Print-ready vector document with layout options',
  },
  { value: 'html', label: 'HTML', icon: '🌐', description: 'Interactive web flashcards' },
  { value: 'svg', label: 'SVG', icon: '🖼️', description: 'Scalable vector images' },
  { value: 'png', label: 'PNG', icon: '📷', description: 'High-resolution images' },
]

export function FormatSelectField({ value, onValueChange }: FormatSelectFieldProps) {
  const selectedOption = formatOptions.find((option) => option.value === value) || formatOptions[0]

  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger
        asChild={false}
        className={css({
          w: 'full',
          px: '4',
          py: '3',
          bg: 'white',
          border: '1px solid',
          borderColor: 'gray.300',
          rounded: 'lg',
          fontSize: 'sm',
          transition: 'all',
          cursor: 'pointer',
          userSelect: 'none',
          _hover: { borderColor: 'gray.400' },
          _focus: {
            outline: 'none',
            borderColor: 'brand.500',
            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
          },
          '&[data-state=open]': {
            borderColor: 'brand.500',
            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
          },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minH: '12',
        })}
      >
        <Select.Value asChild>
          <div className={hstack({ gap: '3', alignItems: 'center' })}>
            <span className={css({ fontSize: 'lg' })}>{selectedOption.icon}</span>
            <div className={stack({ gap: '0', alignItems: 'start' })}>
              <span className={css({ fontWeight: 'medium', color: 'gray.900' })}>
                {selectedOption.label}
              </span>
              <span className={css({ fontSize: 'xs', color: 'gray.500', lineHeight: 'tight' })}>
                {selectedOption.description}
              </span>
            </div>
          </div>
        </Select.Value>
        <Select.Icon>
          <ChevronDown size={16} className={css({ color: 'gray.400' })} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className={css({
            bg: 'white',
            rounded: 'xl',
            shadow: 'modal',
            border: '1px solid',
            borderColor: 'gray.200',
            p: '2',
            zIndex: 999,
            minW: '320px',
            maxH: '300px',
            overflow: 'hidden',
          })}
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport>
            {formatOptions.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className={css({
                  px: '3',
                  py: '3',
                  rounded: 'lg',
                  cursor: 'pointer',
                  transition: 'all',
                  outline: 'none',
                  _hover: { bg: 'brand.50' },
                  '&[data-state=checked]': {
                    bg: 'brand.100',
                    color: 'brand.800',
                  },
                })}
              >
                <div className={hstack({ gap: '3', alignItems: 'center' })}>
                  <span className={css({ fontSize: 'xl' })}>{option.icon}</span>
                  <div className={stack({ gap: '1', alignItems: 'start', flex: 1 })}>
                    <Select.ItemText
                      className={css({
                        fontWeight: 'medium',
                        fontSize: 'sm',
                      })}
                    >
                      {option.label}
                    </Select.ItemText>
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: 'gray.600',
                        lineHeight: 'relaxed',
                      })}
                    >
                      {option.description}
                    </div>
                  </div>
                </div>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
