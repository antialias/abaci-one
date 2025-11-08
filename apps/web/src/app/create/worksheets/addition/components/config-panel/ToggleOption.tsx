import type React from 'react'
import * as Checkbox from '@radix-ui/react-checkbox'
import { css } from '../../../../../../../styled-system/css'

export interface ToggleOptionProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description: string
  children?: React.ReactNode
}

export function ToggleOption({
  checked,
  onChange,
  label,
  description,
  children,
}: ToggleOptionProps) {
  return (
    <div
      data-element="toggle-option-container"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        h: children ? 'auto' : '20',
        bg: checked ? 'brand.50' : 'white',
        border: '2px solid',
        borderColor: checked ? 'brand.500' : 'gray.200',
        rounded: 'lg',
        transition: 'all 0.15s',
        _hover: {
          borderColor: checked ? 'brand.600' : 'gray.300',
          bg: checked ? 'brand.100' : 'gray.50',
        },
      })}
    >
      <Checkbox.Root
        checked={checked}
        onCheckedChange={onChange}
        data-element="toggle-option"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: '1.5',
          p: '2.5',
          bg: 'transparent',
          border: 'none',
          rounded: 'lg',
          cursor: 'pointer',
          textAlign: 'left',
          w: 'full',
          _focus: {
            outline: 'none',
            ring: '2px',
            ringColor: 'brand.300',
          },
        })}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2',
          })}
        >
          <div
            className={css({
              fontSize: 'xs',
              fontWeight: 'semibold',
              color: checked ? 'brand.700' : 'gray.700',
            })}
          >
            {label}
          </div>
          <div
            className={css({
              w: '9',
              h: '5',
              bg: checked ? 'brand.500' : 'gray.300',
              rounded: 'full',
              position: 'relative',
              transition: 'background-color 0.15s',
              flexShrink: 0,
            })}
          >
            <div
              style={{
                position: 'absolute',
                top: '0.125rem',
                left: checked ? '1.125rem' : '0.125rem',
                width: '1rem',
                height: '1rem',
                background: 'white',
                borderRadius: '9999px',
                transition: 'left 0.15s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            />
          </div>
        </div>
        <div
          className={css({
            fontSize: '2xs',
            color: checked ? 'brand.600' : 'gray.500',
            lineHeight: '1.3',
          })}
        >
          {description}
        </div>
      </Checkbox.Root>
      {children}
    </div>
  )
}
