'use client'

import * as Label from '@radix-ui/react-label'
import * as RadioGroup from '@radix-ui/react-radio-group'
import * as Select from '@radix-ui/react-select'
import * as Slider from '@radix-ui/react-slider'
import * as Switch from '@radix-ui/react-switch'
import * as Tabs from '@radix-ui/react-tabs'
import type { FormApi } from '@tanstack/react-form'
import { ChevronDown, Sparkles } from 'lucide-react'
import type { FlashcardFormState } from '@/app/create/page'
import { css } from '../../styled-system/css'
import { grid, hstack, stack } from '../../styled-system/patterns'

interface ConfigurationFormProps {
  form: FormApi<FlashcardFormState>
  onGenerate: (formState: FlashcardFormState) => Promise<void>
  isGenerating: boolean
}

export function ConfigurationForm({ form, onGenerate, isGenerating }: ConfigurationFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onGenerate(form.state.values)
  }

  return (
    <form onSubmit={handleSubmit} className={stack({ gap: '6' })}>
      <div className={stack({ gap: '2' })}>
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            color: 'gray.900',
          })}
        >
          Configuration
        </h2>
        <p
          className={css({
            color: 'gray.600',
          })}
        >
          Content, layout, and output settings
        </p>
      </div>

      <Tabs.Root defaultValue="content" className={css({ w: 'full' })}>
        <Tabs.List
          className={css({
            display: 'flex',
            gap: '1',
            bg: 'gray.100',
            p: '1',
            rounded: 'xl',
          })}
        >
          {[
            { value: 'content', label: '📝 Content', icon: '🔢' },
            { value: 'layout', label: '📐 Layout', icon: '📐' },
            { value: 'output', label: '💾 Output', icon: '💾' },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={css({
                flex: 1,
                px: '3',
                py: '2',
                fontSize: 'sm',
                fontWeight: 'medium',
                rounded: 'lg',
                transition: 'all',
                color: 'gray.600',
                _hover: { color: 'gray.900' },
                '&[data-state=active]': {
                  bg: 'white',
                  color: 'brand.600',
                  shadow: 'card',
                },
              })}
            >
              <span className={css({ mr: '2' })}>{tab.icon}</span>
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Content Tab */}
        <Tabs.Content value="content" className={css({ mt: '6' })}>
          <div className={stack({ gap: '6' })}>
            <FormField
              label="Number Range"
              description="Define which numbers to include (e.g., '0-99' or '1,2,5,10')"
            >
              <form.Field name="range">
                {(field) => (
                  <input
                    value={field.state.value || ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="0-99"
                    className={inputStyles}
                  />
                )}
              </form.Field>
            </FormField>

            <div className={grid({ columns: 2, gap: '4' })}>
              <FormField label="Step Size" description="For ranges, increment by this amount">
                <form.Field name="step">
                  {(field) => (
                    <input
                      type="number"
                      min="1"
                      value={field.state.value || 1}
                      onChange={(e) => field.handleChange(parseInt(e.target.value, 10))}
                      className={inputStyles}
                    />
                  )}
                </form.Field>
              </FormField>

              <FormField label="Shuffle Cards" description="Randomize the order">
                <form.Field name="shuffle">
                  {(field) => (
                    <SwitchField
                      checked={field.state.value || false}
                      onCheckedChange={field.handleChange}
                    />
                  )}
                </form.Field>
              </FormField>
            </div>
          </div>
        </Tabs.Content>

        {/* Layout Tab */}
        <Tabs.Content value="layout" className={css({ mt: '6' })}>
          <div className={stack({ gap: '6' })}>
            <div className={grid({ columns: 2, gap: '4' })}>
              <FormField label="Cards Per Page" description="Number of flashcards on each page">
                <form.Field name="cardsPerPage">
                  {(field) => (
                    <SliderField
                      value={[field.state.value || 6]}
                      onValueChange={([value]) => field.handleChange(value)}
                      min={1}
                      max={12}
                      step={1}
                      formatValue={(value) => `${value} cards`}
                    />
                  )}
                </form.Field>
              </FormField>

              <FormField label="Paper Size" description="Output paper dimensions">
                <form.Field name="paperSize">
                  {(field) => (
                    <SelectField
                      value={field.state.value || 'us-letter'}
                      onValueChange={(value) => field.handleChange(value as any)}
                      options={[
                        { value: 'us-letter', label: 'US Letter (8.5×11")' },
                        { value: 'a4', label: 'A4 (210×297mm)' },
                        { value: 'a3', label: 'A3 (297×420mm)' },
                        { value: 'a5', label: 'A5 (148×210mm)' },
                      ]}
                    />
                  )}
                </form.Field>
              </FormField>
            </div>

            <FormField label="Orientation" description="Page layout direction">
              <form.Field name="orientation">
                {(field) => (
                  <RadioGroupField
                    value={field.state.value || 'portrait'}
                    onValueChange={(value) => field.handleChange(value as any)}
                    options={[
                      {
                        value: 'portrait',
                        label: '📄 Portrait',
                        desc: 'Taller than wide',
                      },
                      {
                        value: 'landscape',
                        label: '📃 Landscape',
                        desc: 'Wider than tall',
                      },
                    ]}
                  />
                )}
              </form.Field>
            </FormField>

            <div className={grid({ columns: 2, gap: '4' })}>
              <FormField label="Show Cut Marks" description="Add guides for cutting cards">
                <form.Field name="showCutMarks">
                  {(field) => (
                    <SwitchField
                      checked={field.state.value || false}
                      onCheckedChange={field.handleChange}
                    />
                  )}
                </form.Field>
              </FormField>

              <FormField
                label="Registration Marks"
                description="Alignment guides for duplex printing"
              >
                <form.Field name="showRegistration">
                  {(field) => (
                    <SwitchField
                      checked={field.state.value || false}
                      onCheckedChange={field.handleChange}
                    />
                  )}
                </form.Field>
              </FormField>
            </div>
          </div>
        </Tabs.Content>

        {/* Output Tab */}
        <Tabs.Content value="output" className={css({ mt: '6' })}>
          <div className={stack({ gap: '6' })}>
            <FormField label="Output Format" description="Choose your preferred file format">
              <form.Field name="format">
                {(field) => (
                  <RadioGroupField
                    value={field.state.value || 'pdf'}
                    onValueChange={(value) => field.handleChange(value as any)}
                    options={[
                      {
                        value: 'pdf',
                        label: '📄 PDF',
                        desc: 'Print-ready vector document',
                      },
                      {
                        value: 'html',
                        label: '🌐 HTML',
                        desc: 'Interactive web flashcards',
                      },
                      {
                        value: 'svg',
                        label: '🖼️ SVG',
                        desc: 'Scalable vector images',
                      },
                      {
                        value: 'png',
                        label: '📷 PNG',
                        desc: 'High-resolution images',
                      },
                    ]}
                  />
                )}
              </form.Field>
            </FormField>

            <FormField label="Scale Factor" description="Adjust the overall size of flashcards">
              <form.Field name="scaleFactor">
                {(field) => (
                  <SliderField
                    value={[field.state.value || 0.9]}
                    onValueChange={([value]) => field.handleChange(value)}
                    min={0.5}
                    max={1.0}
                    step={0.05}
                    formatValue={(value) => `${Math.round(value * 100)}%`}
                  />
                )}
              </form.Field>
            </FormField>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {/* Generate Button */}
      <div
        className={css({
          pt: '6',
          borderTop: '1px solid',
          borderColor: 'gray.200',
        })}
      >
        <button
          type="submit"
          disabled={isGenerating}
          className={css({
            w: 'full',
            px: '6',
            py: '4',
            bg: 'brand.600',
            color: 'white',
            fontSize: 'lg',
            fontWeight: 'semibold',
            rounded: 'xl',
            shadow: 'card',
            transition: 'all',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            opacity: isGenerating ? '0.7' : '1',
            _hover: isGenerating
              ? {}
              : {
                  bg: 'brand.700',
                  transform: 'translateY(-1px)',
                  shadow: 'modal',
                },
          })}
        >
          <span className={hstack({ gap: '3', justify: 'center' })}>
            {isGenerating ? (
              <>
                <div
                  className={css({
                    w: '5',
                    h: '5',
                    border: '2px solid',
                    borderColor: 'white',
                    borderTopColor: 'transparent',
                    rounded: 'full',
                    animation: 'spin 1s linear infinite',
                  })}
                />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Generate Flashcards
              </>
            )}
          </span>
        </button>
      </div>
    </form>
  )
}

// Helper Components
function FormField({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className={stack({ gap: '2' })}>
      <Label.Root
        className={css({
          fontSize: 'sm',
          fontWeight: 'semibold',
          color: 'gray.900',
        })}
      >
        {label}
      </Label.Root>
      {description && (
        <p
          className={css({
            fontSize: 'xs',
            color: 'gray.600',
          })}
        >
          {description}
        </p>
      )}
      {children}
    </div>
  )
}

function SwitchField({
  checked,
  onCheckedChange,
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
        _hover: { bg: checked ? 'brand.700' : 'gray.400' },
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
          willChange: 'transform',
        })}
      />
    </Switch.Root>
  )
}

function RadioGroupField({
  value,
  onValueChange,
  options,
}: {
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string; desc?: string }>
}) {
  return (
    <RadioGroup.Root value={value} onValueChange={onValueChange} className={stack({ gap: '3' })}>
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
                  bg: 'brand.600',
                },
              })}
            />
          </RadioGroup.Item>
          <div className={stack({ gap: '1', flex: 1 })}>
            <label
              className={css({
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'gray.900',
                cursor: 'pointer',
              })}
            >
              {option.label}
            </label>
            {option.desc && (
              <p
                className={css({
                  fontSize: 'xs',
                  color: 'gray.600',
                })}
              >
                {option.desc}
              </p>
            )}
          </div>
        </div>
      ))}
    </RadioGroup.Root>
  )
}

function SelectField({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
}: {
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
}) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger className={inputStyles}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown size={16} />
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
            zIndex: 50,
          })}
        >
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className={css({
                  px: '3',
                  py: '2',
                  fontSize: 'sm',
                  rounded: 'lg',
                  cursor: 'pointer',
                  transition: 'all',
                  _hover: { bg: 'brand.50' },
                  '&[data-state=checked]': {
                    bg: 'brand.100',
                    color: 'brand.800',
                  },
                })}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

function SliderField({
  value,
  onValueChange,
  min,
  max,
  step,
  formatValue,
}: {
  value: number[]
  onValueChange: (value: number[]) => void
  min: number
  max: number
  step: number
  formatValue: (value: number) => string
}) {
  return (
    <div className={stack({ gap: '3' })}>
      <div className={hstack({ justify: 'space-between' })}>
        <span className={css({ fontSize: 'sm', color: 'gray.600' })}>{formatValue(min)}</span>
        <span
          className={css({
            fontSize: 'sm',
            fontWeight: 'medium',
            color: 'brand.600',
          })}
        >
          {formatValue(value[0])}
        </span>
        <span className={css({ fontSize: 'sm', color: 'gray.600' })}>{formatValue(max)}</span>
      </div>

      <Slider.Root
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
        className={css({
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          userSelect: 'none',
          touchAction: 'none',
          w: 'full',
          h: '5',
        })}
      >
        <Slider.Track
          className={css({
            bg: 'gray.200',
            position: 'relative',
            flexGrow: 1,
            rounded: 'full',
            h: '2',
          })}
        >
          <Slider.Range
            className={css({
              position: 'absolute',
              bg: 'brand.600',
              rounded: 'full',
              h: 'full',
            })}
          />
        </Slider.Track>
        <Slider.Thumb
          className={css({
            display: 'block',
            w: '5',
            h: '5',
            bg: 'white',
            shadow: 'card',
            rounded: 'full',
            border: '2px solid',
            borderColor: 'brand.600',
            cursor: 'pointer',
            transition: 'all',
            _hover: { transform: 'scale(1.1)' },
            _focus: {
              outline: 'none',
              boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
            },
          })}
        />
      </Slider.Root>
    </div>
  )
}

const inputStyles = css({
  w: 'full',
  px: '4',
  py: '3',
  bg: 'white',
  border: '1px solid',
  borderColor: 'gray.300',
  rounded: 'lg',
  fontSize: 'sm',
  transition: 'all',
  _hover: { borderColor: 'gray.400' },
  _focus: {
    outline: 'none',
    borderColor: 'brand.500',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  },
})
