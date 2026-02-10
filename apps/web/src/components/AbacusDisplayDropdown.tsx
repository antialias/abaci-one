'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Label from '@radix-ui/react-label'
import * as RadioGroup from '@radix-ui/react-radio-group'
import * as Switch from '@radix-ui/react-switch'
import { AbacusStatic, type BeadShape, type ColorScheme, useAbacusDisplay } from '@soroban/abacus-react'
import { useState } from 'react'
import { css } from '../../styled-system/css'
import { hstack, stack } from '../../styled-system/patterns'
import { Z_INDEX } from '../constants/zIndex'
import { useTheme } from '../contexts/ThemeContext'
import { useAbacusSettings, useUpdateAbacusSettings } from '../hooks/useAbacusSettings'

interface AbacusDisplayDropdownProps {
  isFullscreen?: boolean
  onOpenChange?: (open: boolean) => void
  triggerStyle?: React.CSSProperties
}

/**
 * Standalone panel for abacus style settings.
 * Can be used directly on settings pages or inside dropdowns.
 */
export function AbacusStylePanel({
  isFullscreen = false,
  isDark = false,
  showHeader = true,
}: {
  isFullscreen?: boolean
  isDark?: boolean
  showHeader?: boolean
}) {
  const { config, updateConfig, resetToDefaults } = useAbacusDisplay()
  const { data: abacusSettings } = useAbacusSettings()
  const { mutate: updateAbacusSettings } = useUpdateAbacusSettings()

  return (
    <div className={stack({ gap: '6' })}>
      {/* Header */}
      {showHeader && (
        <div className={stack({ gap: '1' })}>
          <div
            className={hstack({
              justify: 'space-between',
              alignItems: 'center',
            })}
          >
            <h3
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: isFullscreen ? 'white' : isDark ? 'gray.100' : 'gray.900',
              })}
            >
              🎨 Abacus Style
            </h3>
            <button
              type="button"
              onClick={resetToDefaults}
              className={css({
                fontSize: 'xs',
                color: isFullscreen ? 'gray.300' : isDark ? 'gray.400' : 'gray.500',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                _hover: {
                  color: isFullscreen ? 'white' : isDark ? 'gray.200' : 'gray.700',
                },
              })}
            >
              Reset to Defaults
            </button>
          </div>
          <p
            className={css({
              fontSize: 'sm',
              color: isFullscreen ? 'gray.300' : isDark ? 'gray.400' : 'gray.600',
            })}
          >
            Configure display across the entire app
          </p>
        </div>
      )}

      {/* Color Scheme */}
      <FormField label="Color Scheme" isFullscreen={isFullscreen} isDark={isDark}>
        <RadioGroupField
          value={config.colorScheme}
          onValueChange={(value) => updateConfig({ colorScheme: value as ColorScheme })}
          options={[
            { value: 'monochrome', label: 'Monochrome' },
            { value: 'place-value', label: 'Place Value' },
            { value: 'heaven-earth', label: 'Heaven-Earth' },
            { value: 'alternating', label: 'Alternating' },
          ]}
          isFullscreen={isFullscreen}
          isDark={isDark}
        />
      </FormField>

      {/* Bead Shape */}
      <FormField label="Bead Shape" isFullscreen={isFullscreen} isDark={isDark}>
        <RadioGroupField
          value={config.beadShape}
          onValueChange={(value) => updateConfig({ beadShape: value as BeadShape })}
          options={[
            { value: 'diamond', label: '💎 Diamond' },
            { value: 'circle', label: '⭕ Circle' },
            { value: 'square', label: '⬜ Square' },
          ]}
          isFullscreen={isFullscreen}
          isDark={isDark}
        />
      </FormField>

      {/* Toggle Options */}
      <div className={stack({ gap: '4' })}>
        <FormField label="Hide Inactive Beads" isFullscreen={isFullscreen} isDark={isDark}>
          <SwitchField
            checked={config.hideInactiveBeads}
            onCheckedChange={(checked) => updateConfig({ hideInactiveBeads: checked })}
            isFullscreen={isFullscreen}
            isDark={isDark}
          />
        </FormField>

        <FormField label="Colored Numerals" isFullscreen={isFullscreen} isDark={isDark}>
          <SwitchField
            checked={config.coloredNumerals}
            onCheckedChange={(checked) => updateConfig({ coloredNumerals: checked })}
            isFullscreen={isFullscreen}
            isDark={isDark}
          />
        </FormField>

        <FormField label="Sound Effects" isFullscreen={isFullscreen} isDark={isDark}>
          <SwitchField
            checked={config.soundEnabled}
            onCheckedChange={(checked) => updateConfig({ soundEnabled: checked })}
            isFullscreen={isFullscreen}
            isDark={isDark}
          />
        </FormField>

        {config.soundEnabled && (
          <FormField
            label={`Volume: ${Math.round(config.soundVolume * 100)}%`}
            isFullscreen={isFullscreen}
            isDark={isDark}
          >
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.soundVolume}
              onChange={(e) => updateConfig({ soundVolume: parseFloat(e.target.value) })}
              className={css({
                w: 'full',
                h: '2',
                bg: isFullscreen ? 'rgba(255, 255, 255, 0.2)' : isDark ? 'gray.700' : 'gray.200',
                rounded: 'full',
                appearance: 'none',
                cursor: 'pointer',
                _focusVisible: {
                  outline: 'none',
                  ring: '2px',
                  ringColor: isFullscreen ? 'blue.400' : 'brand.500',
                },
                '&::-webkit-slider-thumb': {
                  appearance: 'none',
                  w: '4',
                  h: '4',
                  bg: isFullscreen ? 'blue.400' : 'brand.600',
                  rounded: 'full',
                  cursor: 'pointer',
                  transition: 'all',
                  _hover: {
                    bg: isFullscreen ? 'blue.500' : 'brand.700',
                    transform: 'scale(1.1)',
                  },
                },
                '&::-moz-range-thumb': {
                  w: '4',
                  h: '4',
                  bg: isFullscreen ? 'blue.400' : 'brand.600',
                  rounded: 'full',
                  border: 'none',
                  cursor: 'pointer',
                },
              })}
            />
          </FormField>
        )}

        <FormField label="Native Abacus Numbers" isFullscreen={isFullscreen} isDark={isDark}>
          <SwitchField
            checked={abacusSettings?.nativeAbacusNumbers ?? false}
            onCheckedChange={(checked) => updateAbacusSettings({ nativeAbacusNumbers: checked })}
            isFullscreen={isFullscreen}
            isDark={isDark}
          />
        </FormField>

        <FormField
          label={`Physical Abacus Columns: ${config.physicalAbacusColumns}`}
          isFullscreen={isFullscreen}
          isDark={isDark}
        >
          <div className={hstack({ gap: '2', alignItems: 'center' })}>
            <input
              type="range"
              min="1"
              max="21"
              step="1"
              value={config.physicalAbacusColumns}
              onChange={(e) =>
                updateConfig({
                  physicalAbacusColumns: parseInt(e.target.value, 10),
                })
              }
              className={css({
                flex: 1,
                h: '2',
                bg: isFullscreen ? 'rgba(255, 255, 255, 0.2)' : isDark ? 'gray.700' : 'gray.200',
                rounded: 'full',
                appearance: 'none',
                cursor: 'pointer',
                _focusVisible: {
                  outline: 'none',
                  ring: '2px',
                  ringColor: isFullscreen ? 'blue.400' : 'brand.500',
                },
                '&::-webkit-slider-thumb': {
                  appearance: 'none',
                  w: '4',
                  h: '4',
                  bg: isFullscreen ? 'blue.400' : 'brand.600',
                  rounded: 'full',
                  cursor: 'pointer',
                  transition: 'all',
                  _hover: {
                    bg: isFullscreen ? 'blue.500' : 'brand.700',
                    transform: 'scale(1.1)',
                  },
                },
                '&::-moz-range-thumb': {
                  w: '4',
                  h: '4',
                  bg: isFullscreen ? 'blue.400' : 'brand.600',
                  rounded: 'full',
                  border: 'none',
                  cursor: 'pointer',
                },
              })}
            />
            <span
              className={css({
                fontSize: 'sm',
                fontWeight: 'medium',
                color: isFullscreen ? 'white' : isDark ? 'gray.200' : 'gray.700',
                minW: '6',
                textAlign: 'right',
              })}
            >
              {config.physicalAbacusColumns}
            </span>
          </div>
          <p
            className={css({
              fontSize: 'xs',
              color: isFullscreen ? 'gray.400' : isDark ? 'gray.500' : 'gray.500',
              mt: '1',
            })}
          >
            For camera vision detection
          </p>
        </FormField>
      </div>
    </div>
  )
}

export function AbacusDisplayDropdown({
  isFullscreen = false,
  onOpenChange: onOpenChangeProp,
  triggerStyle,
}: AbacusDisplayDropdownProps) {
  const [open, setOpen] = useState(false)
  const { config } = useAbacusDisplay()
  const [day] = useState(() => new Date().getDate())
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    // Notify parent component
    onOpenChangeProp?.(isOpen)
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={handleOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          style={triggerStyle}
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: '2',
            py: '2',
            fontSize: 'sm',
            fontWeight: 'medium',
            color: isFullscreen ? 'white' : isDark ? 'gray.200' : 'gray.600',
            bg: isFullscreen ? 'rgba(0, 0, 0, 0.85)' : isDark ? 'gray.800' : 'white',
            border: '1px solid',
            borderColor: isFullscreen
              ? 'rgba(255, 255, 255, 0.1)'
              : isDark
                ? 'gray.700'
                : 'gray.200',
            rounded: 'lg',
            shadow: 'lg',
            backdropFilter: isFullscreen ? 'blur(15px)' : 'none',
            transition: 'all',
            cursor: 'pointer',
            _hover: {
              bg: isFullscreen ? 'rgba(0, 0, 0, 0.9)' : isDark ? 'gray.700' : 'gray.50',
              borderColor: isFullscreen
                ? 'rgba(255, 255, 255, 0.2)'
                : isDark
                  ? 'gray.600'
                  : 'gray.300',
            },
            _focus: {
              outline: 'none',
              ring: '2px',
              ringColor: isFullscreen ? 'blue.400' : 'brand.500',
              ringOffset: '1px',
            },
          })}
        >
          <div
            className={css({
              width: '20px',
              height: '20px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '& svg': {
                width: '100%',
                height: '100%',
              },
            })}
          >
            <AbacusStatic
              value={day}
              columns={2}
              beadShape={config.beadShape === 'custom' ? 'diamond' : config.beadShape}
              colorScheme={config.colorScheme}
              hideInactiveBeads={true}
              showNumbers={false}
              frameVisible={true}
              scaleFactor={1.8}
              cropToActiveBeads={{ padding: { top: 8, bottom: 2, left: 5, right: 5 } }}
            />
          </div>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={css({
            bg: isFullscreen ? 'rgba(0, 0, 0, 0.85)' : isDark ? 'gray.900' : 'white',
            rounded: 'xl',
            shadow: 'lg',
            border: '1px solid',
            borderColor: isFullscreen
              ? 'rgba(255, 255, 255, 0.1)'
              : isDark
                ? 'gray.800'
                : 'gray.200',
            backdropFilter: isFullscreen ? 'blur(15px)' : 'none',
            p: '6',
            minW: '320px',
            maxW: '400px',
            maxH: '80vh',
            overflowY: 'auto',
            position: 'relative',
          })}
          style={{
            zIndex: Z_INDEX.GAME_NAV.HAMBURGER_NESTED_DROPDOWN,
          }}
          side="right"
          sideOffset={8}
          align="start"
        >
          <AbacusStylePanel isFullscreen={isFullscreen} isDark={isDark} showHeader={true} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// Helper Components (simplified versions of StyleControls components)
function FormField({
  label,
  children,
  isFullscreen = false,
  isDark = false,
}: {
  label: string
  children: React.ReactNode
  isFullscreen?: boolean
  isDark?: boolean
}) {
  return (
    <div className={stack({ gap: '2' })}>
      <Label.Root
        className={css({
          fontSize: 'sm',
          fontWeight: 'medium',
          color: isFullscreen ? 'white' : isDark ? 'gray.100' : 'gray.900',
        })}
      >
        {label}
      </Label.Root>
      {children}
    </div>
  )
}

function SwitchField({
  checked,
  onCheckedChange,
  isFullscreen = false,
  isDark = false,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  isFullscreen?: boolean
  isDark?: boolean
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={css({
        w: '11',
        h: '6',
        bg: checked
          ? isFullscreen
            ? 'blue.500'
            : 'brand.600'
          : isFullscreen
            ? 'rgba(255, 255, 255, 0.2)'
            : isDark
              ? 'gray.700'
              : 'gray.300',
        rounded: 'full',
        position: 'relative',
        transition: 'all',
        cursor: 'pointer',
        _hover: {
          bg: checked
            ? isFullscreen
              ? 'blue.600'
              : 'brand.700'
            : isFullscreen
              ? 'rgba(255, 255, 255, 0.3)'
              : isDark
                ? 'gray.600'
                : 'gray.400',
        },
      })}
      onClick={(e) => e.stopPropagation()} // Prevent dropdown close only on the switch itself
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
  isFullscreen = false,
  isDark = false,
}: {
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  isFullscreen?: boolean
  isDark?: boolean
}) {
  return (
    <RadioGroup.Root value={value} onValueChange={onValueChange} className={stack({ gap: '2' })}>
      {options.map((option) => (
        <div key={option.value} className={hstack({ gap: '3', alignItems: 'center' })}>
          <RadioGroup.Item
            value={option.value}
            className={css({
              w: '4',
              h: '4',
              rounded: 'full',
              border: '2px solid',
              borderColor: isFullscreen
                ? 'rgba(255, 255, 255, 0.3)'
                : isDark
                  ? 'gray.600'
                  : 'gray.300',
              bg: isFullscreen ? 'rgba(255, 255, 255, 0.1)' : isDark ? 'gray.800' : 'white',
              cursor: 'pointer',
              transition: 'all',
              _hover: { borderColor: isFullscreen ? 'blue.400' : 'brand.400' },
              '&[data-state=checked]': {
                borderColor: isFullscreen ? 'blue.500' : 'brand.600',
              },
            })}
            onClick={(e) => e.stopPropagation()} // Prevent dropdown close only on radio button
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
                  bg: isFullscreen ? 'blue.400' : 'brand.600',
                },
              })}
            />
          </RadioGroup.Item>
          <label
            className={css({
              fontSize: 'sm',
              color: isFullscreen ? 'white' : isDark ? 'gray.200' : 'gray.900',
              cursor: 'pointer',
              flex: 1,
            })}
            onClick={(e) => e.stopPropagation()} // Prevent dropdown close on label click too
          >
            {option.label}
          </label>
        </div>
      ))}
    </RadioGroup.Root>
  )
}
