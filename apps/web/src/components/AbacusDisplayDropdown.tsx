'use client'

import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Label from '@radix-ui/react-label'
import * as RadioGroup from '@radix-ui/react-radio-group'
import * as Switch from '@radix-ui/react-switch'
import { css } from '../../styled-system/css'
import { stack, hstack } from '../../styled-system/patterns'
import { useAbacusDisplay, ColorScheme, BeadShape } from '@/contexts/AbacusDisplayContext'

export function AbacusDisplayDropdown() {
  const [open, setOpen] = useState(false)
  const { config, updateConfig, resetToDefaults } = useAbacusDisplay()

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            px: '3',
            py: '2',
            fontSize: 'sm',
            fontWeight: 'medium',
            color: 'gray.600',
            bg: 'white',
            border: '1px solid',
            borderColor: 'gray.200',
            rounded: 'lg',
            shadow: 'sm',
            transition: 'all',
            cursor: 'pointer',
            _hover: {
              bg: 'gray.50',
              borderColor: 'gray.300'
            },
            _focus: {
              outline: 'none',
              ring: '2px',
              ringColor: 'brand.500',
              ringOffset: '1px'
            }
          })}
        >
          <span className={css({ fontSize: 'lg' })}>🧮</span>
          <span>Style</span>
          <svg
            className={css({
              w: '4',
              h: '4',
              transition: 'transform',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
            })}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={css({
            bg: 'white',
            rounded: 'xl',
            shadow: 'modal',
            border: '1px solid',
            borderColor: 'gray.200',
            p: '6',
            minW: '320px',
            maxW: '400px',
            zIndex: 50,
            animation: 'fadeIn 0.2s ease-out'
          })}
          sideOffset={8}
          align="end"
        >
          <div className={stack({ gap: '6' })}>
            {/* Header */}
            <div className={stack({ gap: '1' })}>
              <div className={hstack({ justify: 'space-between', alignItems: 'center' })}>
                <h3 className={css({
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  color: 'gray.900'
                })}>
                  🎨 Abacus Style
                </h3>
                <button
                  onClick={resetToDefaults}
                  className={css({
                    fontSize: 'xs',
                    color: 'gray.500',
                    _hover: { color: 'gray.700' }
                  })}
                >
                  Reset
                </button>
              </div>
              <p className={css({
                fontSize: 'sm',
                color: 'gray.600'
              })}>
                Configure display across the entire app
              </p>
            </div>

            {/* Color Scheme */}
            <FormField label="Color Scheme">
              <RadioGroupField
                value={config.colorScheme}
                onValueChange={(value) => updateConfig({ colorScheme: value as ColorScheme })}
                options={[
                  { value: 'monochrome', label: 'Monochrome' },
                  { value: 'place-value', label: 'Place Value' },
                  { value: 'heaven-earth', label: 'Heaven-Earth' },
                  { value: 'alternating', label: 'Alternating' }
                ]}
              />
            </FormField>

            {/* Bead Shape */}
            <FormField label="Bead Shape">
              <RadioGroupField
                value={config.beadShape}
                onValueChange={(value) => updateConfig({ beadShape: value as BeadShape })}
                options={[
                  { value: 'diamond', label: '💎 Diamond' },
                  { value: 'circle', label: '⭕ Circle' },
                  { value: 'square', label: '⬜ Square' }
                ]}
              />
            </FormField>

            {/* Toggle Options */}
            <div className={stack({ gap: '4' })}>
              <FormField label="Hide Inactive Beads">
                <SwitchField
                  checked={config.hideInactiveBeads}
                  onCheckedChange={(checked) => updateConfig({ hideInactiveBeads: checked })}
                />
              </FormField>

              <FormField label="Colored Numerals">
                <SwitchField
                  checked={config.coloredNumerals}
                  onCheckedChange={(checked) => updateConfig({ coloredNumerals: checked })}
                />
              </FormField>
            </div>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// Helper Components (simplified versions of StyleControls components)
function FormField({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className={stack({ gap: '2' })}>
      <Label.Root className={css({
        fontSize: 'sm',
        fontWeight: 'medium',
        color: 'gray.900'
      })}>
        {label}
      </Label.Root>
      {children}
    </div>
  )
}

function SwitchField({
  checked,
  onCheckedChange
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={css({
        w: '11',
        h: '6',
        bg: checked ? 'brand.600' : 'gray.300',
        rounded: 'full',
        position: 'relative',
        transition: 'all',
        cursor: 'pointer',
        _hover: { bg: checked ? 'brand.700' : 'gray.400' }
      })}
    >
      <Switch.Thumb
        className={css({
          display: 'block',
          w: '5',
          h: '5',
          bg: 'white',
          rounded: 'full',
          shadow: 'sm',
          transition: 'transform 0.2s',
          transform: checked ? 'translateX(20px)' : 'translateX(0px)',
          willChange: 'transform'
        })}
      />
    </Switch.Root>
  )
}

function RadioGroupField({
  value,
  onValueChange,
  options
}: {
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      className={stack({ gap: '2' })}
    >
      {options.map((option) => (
        <div key={option.value} className={hstack({ gap: '3', alignItems: 'center' })}>
          <RadioGroup.Item
            value={option.value}
            className={css({
              w: '4',
              h: '4',
              rounded: 'full',
              border: '2px solid',
              borderColor: 'gray.300',
              bg: 'white',
              cursor: 'pointer',
              transition: 'all',
              _hover: { borderColor: 'brand.400' },
              '&[data-state=checked]': { borderColor: 'brand.600' }
            })}
          >
            <RadioGroup.Indicator
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                w: 'full',
                h: 'full',
                position: 'relative',
                _after: {
                  content: '""',
                  display: 'block',
                  w: '1.5',
                  h: '1.5',
                  rounded: 'full',
                  bg: 'brand.600'
                }
              })}
            />
          </RadioGroup.Item>
          <label className={css({
            fontSize: 'sm',
            color: 'gray.900',
            cursor: 'pointer'
          })}>
            {option.label}
          </label>
        </div>
      ))}
    </RadioGroup.Root>
  )
}