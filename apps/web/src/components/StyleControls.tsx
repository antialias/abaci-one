'use client'

import { FormApi } from '@tanstack/react-form'
import * as Label from '@radix-ui/react-label'
import * as RadioGroup from '@radix-ui/react-radio-group'
import * as Switch from '@radix-ui/react-switch'
import { css } from '../../styled-system/css'
import { stack, hstack, grid } from '../../styled-system/patterns'
import { FlashcardFormState } from '@/app/create/page'
import { useAbacusDisplay } from '@soroban/abacus-react'
import { useEffect } from 'react'

interface StyleControlsProps {
  form: FormApi<FlashcardFormState>
}

export function StyleControls({ form }: StyleControlsProps) {
  const { config, updateConfig } = useAbacusDisplay()

  // Sync form values with global context
  useEffect(() => {
    form.setFieldValue('colorScheme', config.colorScheme)
    form.setFieldValue('beadShape', config.beadShape)
    form.setFieldValue('hideInactiveBeads', config.hideInactiveBeads)
    form.setFieldValue('coloredNumerals', config.coloredNumerals)
  }, [config, form])
  return (
    <div className={stack({ gap: '4' })}>
      <FormField
        label="Color Scheme"
        description="Choose how colors are applied to beads"
      >
        <form.Field name="colorScheme">
          {(field) => (
            <RadioGroupField
              value={field.state.value || 'place-value'}
              onValueChange={(value) => {
                field.handleChange(value as any)
                updateConfig({ colorScheme: value as any })
              }}
              options={[
                { value: 'monochrome', label: 'Monochrome', desc: 'Classic black and white' },
                { value: 'place-value', label: 'Place Value', desc: 'Colors by digit position' },
                { value: 'heaven-earth', label: 'Heaven-Earth', desc: 'Different colors for 5s and 1s' },
                { value: 'alternating', label: 'Alternating', desc: 'Alternating column colors' }
              ]}
            />
          )}
        </form.Field>
      </FormField>

      <FormField
        label="Bead Shape"
        description="Choose the visual style of the beads"
      >
        <form.Field name="beadShape">
          {(field) => (
            <RadioGroupField
              value={field.state.value || 'diamond'}
              onValueChange={(value) => {
                field.handleChange(value as any)
                updateConfig({ beadShape: value as any })
              }}
              options={[
                { value: 'diamond', label: '💎 Diamond', desc: 'Realistic 3D appearance' },
                { value: 'circle', label: '⭕ Circle', desc: 'Traditional round beads' },
                { value: 'square', label: '⬜ Square', desc: 'Modern geometric style' }
              ]}
            />
          )}
        </form.Field>
      </FormField>

      <div className={grid({ columns: 1, gap: '4' })}>
        <FormField
          label="Colored Numerals"
          description="Match numeral colors to bead colors"
        >
          <form.Field name="coloredNumerals">
            {(field) => (
              <SwitchField
                checked={field.state.value || false}
                onCheckedChange={(checked) => {
                  field.handleChange(checked)
                  updateConfig({ coloredNumerals: checked })
                }}
              />
            )}
          </form.Field>
        </FormField>

        <FormField
          label="Hide Inactive Beads"
          description="Show only active beads for clarity"
        >
          <form.Field name="hideInactiveBeads">
            {(field) => (
              <SwitchField
                checked={field.state.value || false}
                onCheckedChange={(checked) => {
                  field.handleChange(checked)
                  updateConfig({ hideInactiveBeads: checked })
                }}
              />
            )}
          </form.Field>
        </FormField>
      </div>
    </div>
  )
}

// Helper Components
function FormField({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className={stack({ gap: '2' })}>
      <Label.Root className={css({
        fontSize: 'sm',
        fontWeight: 'semibold',
        color: 'gray.900'
      })}>
        {label}
      </Label.Root>
      {description && (
        <p className={css({
          fontSize: 'xs',
          color: 'gray.600'
        })}>
          {description}
        </p>
      )}
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
          shadow: 'card',
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
  options: Array<{ value: string; label: string; desc?: string }>
}) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      className={stack({ gap: '3' })}
    >
      {options.map((option) => (
        <div key={option.value} className={hstack({ gap: '3', alignItems: 'start' })}>
          <RadioGroup.Item
            value={option.value}
            className={css({
              w: '5',
              h: '5',
              rounded: 'full',
              border: '2px solid',
              borderColor: 'gray.300',
              bg: 'white',
              cursor: 'pointer',
              transition: 'all',
              _hover: { borderColor: 'brand.400' },
              '&[data-state=checked]': { borderColor: 'brand.600' },
              mt: '0.5'
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
                  w: '2',
                  h: '2',
                  rounded: 'full',
                  bg: 'brand.600'
                }
              })}
            />
          </RadioGroup.Item>
          <div className={stack({ gap: '0.5', flex: 1 })}>
            <label className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.900',
              cursor: 'pointer'
            })}>
              {option.label}
            </label>
            {option.desc && (
              <p className={css({
                fontSize: 'xs',
                color: 'gray.600',
                lineHeight: 'tight'
              })}>
                {option.desc}
              </p>
            )}
          </div>
        </div>
      ))}
    </RadioGroup.Root>
  )
}